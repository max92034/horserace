import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

/**
 * Safe storage adapter for Supabase that survives iOS Safari edge cases:
 *  - Private Browsing mode (localStorage throws QUOTA_EXCEEDED_ERR)
 *  - ITP (Intelligent Tracking Prevention) blocking storage
 *  - Quota exceeded on small iOS storage allocations
 *
 * Falls back to in-memory storage silently when localStorage is unavailable.
 */
class SafeStorageAdapter {
  private memoryStore: Record<string, string> = {};
  private readonly fallbackToMemory: boolean;

  constructor() {
    let available = false;
    try {
      // Probe localStorage - iOS Private Browsing blocks writes entirely.
      const probe = '__supabase_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      available = true;
    } catch {
      available = false;
    }
    this.fallbackToMemory = !available;
  }

  getItem(key: string): string | null {
    if (this.fallbackToMemory) {
      return this.memoryStore[key] ?? null;
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return this.memoryStore[key] ?? null;
    }
  }

  setItem(key: string, value: string): void {
    if (this.fallbackToMemory) {
      this.memoryStore[key] = value;
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      // iOS quota exceeded, ITP, or Private Browsing — silently fall back
      this.memoryStore[key] = value;
    }
  }

  removeItem(key: string): void {
    if (this.fallbackToMemory) {
      delete this.memoryStore[key];
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      delete this.memoryStore[key];
    }
  }
}

const safeStorage = new SafeStorageAdapter();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
