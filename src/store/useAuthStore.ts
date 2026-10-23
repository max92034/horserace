import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  is_admin: boolean;
}

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  isPasswordRecovery: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  clearPasswordRecovery: () => void;
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

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  isPasswordRecovery: false,

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
    const diag: Record<string, unknown> = {};
    diag.ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    diag.now = new Date().toISOString();
    try {
      // Quick pre-flight storage check so the diagnostic panel has data
      try {
        const probe = '__diag_probe__';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        diag.localStorage = 'ok';
      } catch (e) {
        diag.localStorage = `blocked: ${(e as Error).name}`;
      }
      try {
        diag.cookieEnabled = navigator.cookieEnabled;
      } catch {
        diag.cookieEnabled = 'n/a';
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });
      if (error) {
        diag.path = 'supabase-error';
        diag.name = error.name;
        diag.message = error.message;
        diag.code = (error as { code?: unknown }).code ?? null;
        // eslint-disable-next-line no-console
        console.warn('[auth] signInWithPassword returned error:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 200),
        });
        localStorage.setItem('__auth_diag__', JSON.stringify(diag));
        return error.message;
      }
      localStorage.removeItem('__auth_diag__');
      return null;
    } catch (err: unknown) {
      const e = err as Error;
      diag.path = 'exception';
      diag.name = e?.name ?? 'Unknown';
      diag.message = e?.message ?? String(err);
      diag.stack = e?.stack?.substring(0, 300) ?? '';

      // eslint-disable-next-line no-console
      console.error('[auth] signIn threw:', diag);

      // Human-friendly mapping for common iOS Safari failure modes
      const ua = (diag.ua as string).toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && 'ontouchend' in document);
      diag.isIOS = isIOS;
      const msg = diag.message as string;

      localStorage.setItem('__auth_diag__', JSON.stringify(diag));

      if (msg.includes('network') || msg.includes('fetch') || diag.name === 'TypeError') {
        if (isIOS) {
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
}));
