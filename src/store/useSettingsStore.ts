import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'gold' | 'lakers';

interface SettingsState {
  theme: ThemeMode;
  viewMode: 'grid' | 'list';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  toggleViewMode: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      viewMode: 'grid',
      setTheme: (theme: ThemeMode) => set({ theme }),
      toggleTheme: () => {
        const current = get().theme;
        const modes: ThemeMode[] = ['light', 'dark', 'gold', 'lakers'];
        const nextIndex = (modes.indexOf(current) + 1) % modes.length;
        set({ theme: modes[nextIndex] });
      },
      setViewMode: (mode: 'grid' | 'list') => set({ viewMode: mode }),
      toggleViewMode: () => {
        const current = get().viewMode;
        set({ viewMode: current === 'grid' ? 'list' : 'grid' });
      },
    }),
    {
      name: 'tradeshow-settings',
    }
  )
);
