import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  is_admin: boolean;
}

/**
 * Diagnostic record written on every sign-in attempt, IN MEMORY ONLY so it
 * survives Private Browsing / ITP / quota blocks. The Login page reads this
 * state directly — no localStorage round-trip needed.
 */
export type AuthDiag = Record<string, unknown>;

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  isPasswordRecovery: boolean;
  lastDiag: AuthDiag | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  clearPasswordRecovery: () => void;
  clearDiag: () => void;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_admin')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

let initialized = false;

/**
 * Best-effort write-through to localStorage so users with normal storage
 * can still inspect the diag (e.g. desktop devtools). Always wrapped so
 * a blocked storage never surfaces — the Zustand state is canonical.
 */
function bestEffortLocalStoreDump(diag: AuthDiag) {
  try {
    localStorage.setItem('__auth_diag__', JSON.stringify(diag));
  } catch { /* iOS Private Browsing / ITP — ignore */ }
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  isPasswordRecovery: false,
  lastDiag: null,

  init: async () => {
    if (initialized) return;
    initialized = true;

    // Subscribe before getSession so the PASSWORD_RECOVERY event fired while
    // processing a recovery URL is not missed.
    supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        set({ isPasswordRecovery: true });
      }
      set({ session: nextSession });
      if (nextSession) {
        // defer to avoid deadlocking the auth client callback
        setTimeout(async () => {
          const p = await fetchProfile(nextSession.user.id);
          set({ profile: p, isAdmin: p?.is_admin ?? false });
        }, 0);
      } else {
        set({ profile: null, isAdmin: false });
      }
    });

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const profile = session ? await fetchProfile(session.user.id) : null;
    set({ session, profile, isAdmin: profile?.is_admin ?? false, loading: false });
  },

  signIn: async (email, password) => {
    const diag: AuthDiag = {
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      now: new Date().toISOString(),
    };

    // Pre-flight environment probes — all wrapped so nothing throws.
    try {
      const probe = '__diag_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      diag.localStorage = 'ok';
    } catch (e) {
      diag.localStorage = `blocked: ${(e as Error).name}`;
    }
    try { diag.cookieEnabled = navigator.cookieEnabled; } catch { diag.cookieEnabled = 'n/a'; }
    try { diag.onLine = navigator.onLine; } catch { /* ignore */ }

    // iOS / Safari detection
    const ua = String(diag.ua).toLowerCase();
    diag.isIOS = /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && 'ontouchend' in document);

    const commitDiag = () => {
      set({ lastDiag: diag });
      bestEffortLocalStoreDump(diag);
    };

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });
      if (error) {
        diag.path = 'supabase-error';
        diag.name = error.name;
        diag.message = error.message;
        (diag as { code?: unknown }).code = (error as { code?: unknown }).code ?? null;
        // eslint-disable-next-line no-console
        console.warn('[auth] signInWithPassword returned error:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 200),
        });
        commitDiag();
        return error.message;
      }
      // success — clear any stale diagnostic
      set({ lastDiag: null });
      try { localStorage.removeItem('__auth_diag__'); } catch { /* ignore */ }
      return null;
    } catch (err: unknown) {
      const e = err as Error;
      diag.path = 'exception';
      diag.name = e?.name ?? 'Unknown';
      diag.message = e?.message ?? String(err);
      diag.stack = e?.stack?.substring(0, 300) ?? '';

      // eslint-disable-next-line no-console
      console.error('[auth] signIn threw:', diag);

      commitDiag();

      const msg = diag.message as string;

      if (msg.includes('network') || msg.includes('fetch') || diag.name === 'TypeError') {
        if (diag.isIOS) {
          return 'Unable to connect to the server. On iPhone, please check that you are not in Private Browsing mode, or try a different browser.';
        }
        return 'Network error. Please check your connection and try again.';
      }
      if (msg.includes('Storage') || msg.includes('QuotaExceeded')) {
        return 'Unable to save your login session. Please disable Private Browsing or update your browser.';
      }
      return (diag.message as string) || 'Unknown error during sign-in.';
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, isAdmin: false, isPasswordRecovery: false });
  },

  clearPasswordRecovery: () => {
    set({ isPasswordRecovery: false });
  },

  clearDiag: () => {
    set({ lastDiag: null });
  },
}));
