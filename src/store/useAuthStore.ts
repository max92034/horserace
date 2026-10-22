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
    const { error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password });
    return error ? error.message : null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, isAdmin: false, isPasswordRecovery: false });
  },

  clearPasswordRecovery: () => {
    set({ isPasswordRecovery: false });
  },
}));
