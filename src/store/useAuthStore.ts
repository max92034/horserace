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

function supabaseUrlFromClient(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string) ?? '';
}

/**
 * Lightweight probe to distinguish between:
 *   - CORS block (server reachable but doesn't allow this Origin)
 *   - Network block (server not reachable at all)
 *   - Server OK (200 response with CORS headers)
 */
async function probeSupabaseReachability(_diag: AuthDiag): Promise<AuthDiag> {
  const result: AuthDiag = { probeAt: new Date().toISOString() };
  const base = supabaseUrlFromClient().replace(/\/$/, '');
  if (!base) {
    result.probe = 'skipped: no supabase url';
    return result;
  }

  // 1) Can the browser reach the host at all? (no-cors → opaque is fine)
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${base}/auth/v1/health`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(t);
    result.noCorsFetch = { ok: true, status: r.status || 'opaque' };
  } catch (e: unknown) {
    const err = e as Error;
    result.noCorsFetch = { ok: false, name: err.name, message: err.message };
    result.networkLevel = 'blocked';
    return result;
  }

  // 2) Real CORS fetch to auth endpoint — check Access-Control-Allow-Origin
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${base}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'probe@invalid.local', password: 'probe' }),
    });
    clearTimeout(t);
    const allowOrigin = r.headers.get('access-control-allow-origin') ?? null;
    result.corsFetch = {
      status: r.status,
      allowOrigin,
      origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
    };
    result.corsOK = r.ok || r.status === 400; // bad creds expected → CORS is fine
  } catch (e: unknown) {
    const err = e as Error;
    result.corsFetch = { ok: false, name: err.name, message: err.message };
    result.corsOK = false;
  }

  return result;
}

/** Build a user-friendly message from the diagnostic after a fetch failure. */
function buildFetchErrorMsg(diag: AuthDiag): string {
  const origin = String(diag.origin ?? 'this page');
  const host = String(diag.supabaseHost ?? 'Supabase');

  const corsInfo = diag.corsFetch as { ok?: boolean; allowOrigin?: string; origin?: string } | undefined;
  const netBlocked = (diag.networkLevel as string | undefined) === 'blocked';

  if (netBlocked) {
    const ua = String(diag.ua ?? '').toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      return (
        `Cannot reach ${host}. On iPhone this is often caused by a Content Blocker ` +
        `(AdGuard, 1Blocker, uBlock, etc.) blocking the connection. Try disabling it for ` +
        `this site in Settings → Safari → Content Blockers, or switch Wi-Fi/mobile data.`
      );
    }
    return (
      `Cannot reach ${host} at all — your network (Wi-Fi or data) appears to be ` +
      `blocking the connection. Try switching Wi-Fi/mobile data, disabling VPN/ad-blockers, ` +
      `or try a different browser.`
    );
  }

  if (diag.corsOK === false) {
    const allowOrigin = corsInfo?.allowOrigin ?? '(not returned)';
    return (
      `Sign-in blocked by CORS. The Supabase project has not added "${origin}" to its ` +
      `allowed auth origins. Ask the admin to add it in the Supabase dashboard → ` +
      `Authentication → URL Configuration. (Server echo: ${allowOrigin})`
    );
  }

  const ua = String(diag.ua ?? '').toLowerCase();
  if (/heytapbrowser|huaweibrowser|honorbrowser|samsunginternet/i.test(ua)) {
    return (
      `Unable to connect to sign-in server. This browser appears to be blocking third-party ` +
      `requests. Please try opening this page in Chrome or Safari instead.`
    );
  }

  return `Network error. Cannot reach the sign-in server right now. Please try again later.`;
}

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
    try { diag.origin = window.location.origin; } catch { /* ignore */ }
    try { diag.supabaseHost = new URL(supabaseUrlFromClient()).hostname; } catch { /* ignore */ }

    // iOS / Safari detection
    const ua = String(diag.ua).toLowerCase();
    diag.isIOS = /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && 'ontouchend' in document);

    const commitDiag = () => {
      set({ lastDiag: diag });
      bestEffortLocalStoreDump(diag);
    };

    try {
      // Wrap with a timeout so the UI never hangs forever on a dead network.
      const TIMEOUT_MS = 15000;
      const signInPromise = supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
      );
      const signInResult = await Promise.race([signInPromise, timeoutPromise]) as Awaited<typeof signInPromise>;
      const { error } = signInResult;
      if (error) {
        diag.path = 'supabase-error';
        diag.name = error.name;
        diag.message = error.message;
        (diag as { code?: unknown }).code = (error as { code?: unknown }).code ?? null;

        // AuthRetryableFetchError == browser could not reach Supabase at all
        // (CORS blocked, network blocked, or server unreachable). Try to
        // distinguish them with a lightweight pre-flight probe.
        const isFetchFailure =
          error.name === 'AuthRetryableFetchError' ||
          /(failed to fetch|load failed|networkerror)/i.test(error.message ?? '');
        if (isFetchFailure) {
          const probeResult = await probeSupabaseReachability(diag);
          Object.assign(diag, probeResult);
          commitDiag();
          return buildFetchErrorMsg(diag);
        }

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
      const isNetworkLike =
        /(network|fetch|load failed|networkerror|typeerror)/i.test(msg) ||
        diag.name === 'TypeError' ||
        diag.name === 'AuthRetryableFetchError';

      if (isNetworkLike) {
        // Run the probe to tell CORS vs network vs content-blocker apart.
        Object.assign(diag, await probeSupabaseReachability(diag));
        commitDiag();
        return buildFetchErrorMsg(diag);
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
