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
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[auth] signInWithPassword returned error:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 200),
        });
        return error.message;
      }
      return null;
    } catch (err: unknown) {
      // Catch raw exceptions (network, CORS, storage, etc.) that Supabase-js
      // didn't wrap into its normal error shape.
      const e = err as Error;
      // eslint-disable-next-line no-console
      console.error('[auth] signIn threw:', {
        name: e?.name ?? 'Unknown',
        message: e?.message ?? String(err),
        stack: e?.stack?.substring(0, 300),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      });

      // Human-friendly mapping for common iOS Safari failure modes
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
      const isIOS = /iphone|ipad|ipod/.test(ua) || /macintosh/.test(ua) && 'ontouchend' in document;
      const msg = e?.message ?? '';

      if (msg.includes('network') || msg.includes('fetch') || e?.name === 'TypeError') {
        if (isIOS) {
          return 'Unable to connect to the server. On iPhone, please check that you are not in Private Browsing mode, or try a different browser.';
        }
        return 'Network error. Please check your connection and try again.';
      }
      if (msg.includes('Storage') || msg.includes('QuotaExceeded')) {
        return 'Unable to save your login session. Please disable Private Browsing or update your browser.';
      }
      return msg || 'Unknown error during sign-in.';
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
