import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { InventorySession } from '../types';
import { generateId } from '../utils/formatters';

export type AddScanResult = 'added' | 'duplicate';

interface InventoryState {
  sessions: InventorySession[];
  activeSessionId: string | null;
  startSession: (location: string) => string;
  addScan: (sku: string) => AddScanResult;
  removeScan: (sku: string) => void;
  completeSession: (id: string) => void;
  resumeSession: (id: string) => void;
  deleteSession: (id: string) => void;
  leaveSession: () => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      startSession: (location: string) => {
        const now = new Date().toISOString();
        const session: InventorySession = {
          id: generateId(),
          location: location.trim(),
          status: 'active',
          scans: [],
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        };
        set({ sessions: [session, ...get().sessions], activeSessionId: session.id });
        return session.id;
      },

      // Newest scan first so the UI list reads top-down. Dedupe is
      // case-insensitive — scanners and manual entry often differ in case.
      addScan: (sku: string) => {
        const session = get().sessions.find(s => s.id === get().activeSessionId);
        if (!session) return 'duplicate';
        const normalized = sku.trim();
        if (!normalized) return 'duplicate';
        const exists = session.scans.some(s => s.sku.toLowerCase() === normalized.toLowerCase());
        if (exists) return 'duplicate';
        const updated: InventorySession = {
          ...session,
          scans: [{ sku: normalized, scannedAt: new Date().toISOString() }, ...session.scans],
          updatedAt: new Date().toISOString(),
        };
        set({ sessions: get().sessions.map(s => (s.id === session.id ? updated : s)) });
        return 'added';
      },

      removeScan: (sku: string) => {
        const session = get().sessions.find(s => s.id === get().activeSessionId);
        if (!session) return;
        const updated: InventorySession = {
          ...session,
          scans: session.scans.filter(s => s.sku !== sku),
          updatedAt: new Date().toISOString(),
        };
        set({ sessions: get().sessions.map(s => (s.id === session.id ? updated : s)) });
      },

      completeSession: (id: string) => {
        const now = new Date().toISOString();
        set({
          sessions: get().sessions.map(s =>
            s.id === id ? { ...s, status: 'completed', completedAt: now, updatedAt: now } : s
          ),
          activeSessionId: get().activeSessionId === id ? null : get().activeSessionId,
        });
      },

      // Reopening a completed session flips it back to active so missed
      // items can be added; completing it again later just re-stamps the dates.
      resumeSession: (id: string) => {
        set({
          sessions: get().sessions.map(s =>
            s.id === id
              ? { ...s, status: 'active', completedAt: null, updatedAt: new Date().toISOString() }
              : s
          ),
          activeSessionId: id,
        });
      },

      deleteSession: (id: string) => {
        set({
          sessions: get().sessions.filter(s => s.id !== id),
          activeSessionId: get().activeSessionId === id ? null : get().activeSessionId,
        });
      },

      leaveSession: () => set({ activeSessionId: null }),
    }),
    {
      name: 'tradeshow_inventory',
      partialize: (state) => ({ sessions: state.sessions, activeSessionId: state.activeSessionId }),
    }
  )
);
