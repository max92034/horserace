import { StateStorage } from 'zustand/middleware';

/**
 * localStorage adapter for zustand persist that understands the legacy
 * format previously written by utils/storage: a bare JSON.stringify of the
 * data (e.g. a plain array), instead of persist's `{ state, version }`
 * envelope. Legacy values are wrapped on read (mapped into the persisted
 * state shape by `mapLegacy`); persist then rewrites the key in the new
 * format on the next save, so existing users keep their data.
 */
export function createLegacyJsonStorage<TLegacy>(
  mapLegacy: (legacy: TLegacy) => object
): StateStorage {
  return {
    getItem: (name) => {
      let raw: string | null;
      try {
        raw = localStorage.getItem(name);
      } catch {
        return null;
      }
      if (raw === null) return null;
      try {
        const parsed = JSON.parse(raw);
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          'state' in parsed
        ) {
          // Already in zustand persist format
          return raw;
        }
        // Legacy bare JSON — wrap into persist format
        return JSON.stringify({ state: mapLegacy(parsed as TLegacy), version: 0 });
      } catch (e) {
        console.error('Failed to load from localStorage:', e);
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, value);
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch {
        // ignore
      }
    },
  };
}
