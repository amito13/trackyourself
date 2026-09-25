import { createStore } from 'zustand/vanilla';

export type ThemeMode = 'light' | 'dark';
interface ThemeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}
interface AppearanceState {
  mode: ThemeMode;
  hydrated: boolean;
  error: string | null;
  hydrate(): Promise<void>;
  setMode(mode: ThemeMode): void;
}
export const APPEARANCE_KEY = 'outdo.appearance';

export function createAppearanceStore(storage: ThemeStorage) {
  let hydration: Promise<void> | null = null;
  let revision = 0;
  let writes = Promise.resolve();
  return createStore<AppearanceState>((set) => ({
    mode: 'dark',
    hydrated: false,
    error: null,
    hydrate() {
      if (hydration) return hydration;
      const initialRevision = revision;
      hydration = storage.getItem(APPEARANCE_KEY).then((saved) => {
        if (revision === initialRevision && (saved === 'light' || saved === 'dark')) set({ mode: saved });
      }).catch(() => {
        if (revision === initialRevision) set({ error: 'Could not load your appearance preference.' });
      }).finally(() => set({ hydrated: true }));
      return hydration;
    },
    setMode(mode) {
      const change = ++revision;
      set({ mode, error: null });
      // Preserve tap order even if the storage backend is slow.
      writes = writes.then(async () => {
        await storage.setItem(APPEARANCE_KEY, mode);
        if (change === revision) set({ error: null });
      }).catch(() => {
        if (change === revision) set({ error: 'Theme changed, but could not be saved. Tap your choice to retry.' });
      });
    },
  }));
}
