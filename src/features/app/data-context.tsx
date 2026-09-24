import { AppState } from 'react-native';
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import { createSyncController, type SyncState } from '@/db/sync/controller';
import { uploadPending } from '@/db/sync/upload';
import { supabase } from '@/lib/supabase';
import type { Repositories } from '@/db/repositories';
import { useAuthStore } from '@/state/auth-store';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface DataState {
  repositories: Repositories | null;
  error: string | null;
  retry: () => void;
  sync: SyncState;
  syncNow: () => void;
}
const DataContext = createContext<DataState>({
  sync: { status: 'pending', pending: 0, error: null, lastSyncedAt: null },
  syncNow: () => {},
  repositories: null,
  error: null,
  retry: () => {},
});

export function DataProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState<{
    userId: string;
    repositories: Repositories | null;
    error: string | null;
  } | null>(null);
  const [sync, setSync] = useState<SyncState>({ status: 'pending', pending: 0, error: null, lastSyncedAt: null });
  const syncRef = useRef<ReturnType<typeof createSyncController> | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    let cancelled = false;
    async function load() {
      try {
        const { openRepositories } = await import('@/db/sqlite/open');
        const repositories = await openRepositories(currentUser.id);
        await repositories.profile.cacheIdentity({
          id: currentUser.id,
          name:
            currentUser.user_metadata.full_name ??
            currentUser.user_metadata.name ??
            'Athlete',
          email: currentUser.email ?? null,
          avatarUrl: currentUser.user_metadata.avatar_url ?? null,
        });
        if (!cancelled) setState({ userId: currentUser.id, repositories, error: null });
      } catch (error) {
        if (!cancelled)
          setState({
            userId: currentUser.id,
            repositories: null,
            error:
              error instanceof Error ? error.message : 'Could not open your saved data.',
          });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, attempt]);
  useEffect(() => {
    const repositories = state?.userId === user?.id ? state?.repositories : null;
    if (!repositories) return;
    const controller = createSyncController(repositories,
      (isCurrent) => uploadPending(repositories, supabase, isCurrent), setSync);
    syncRef.current = controller;
    controller.setActive(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    let disposed = false;
    let receivedNetworkEvent = false;
    const network = addNetworkStateListener((value) => {
      receivedNetworkEvent = true;
      controller.setOnline(value.isConnected !== false && value.isInternetReachable !== false);
    });
    void getNetworkStateAsync().then((value) => {
      if (!disposed && !receivedNetworkEvent) controller.setOnline(value.isConnected !== false && value.isInternetReachable !== false);
    }).catch(() => { if (!disposed) void controller.sync(); });
    const appState = AppState.addEventListener('change', (value) => controller.setActive(value === 'active'));
    const timer = setInterval(() => void controller.sync(), 15000);
    return () => {
      disposed = true;
      controller.stop();
      clearInterval(timer);
      network.remove();
      appState.remove();
      if (syncRef.current === controller) syncRef.current = null;
    };
  }, [state, user?.id]);
  return (
    <DataContext.Provider
      value={{
        sync,
        syncNow: () => { void syncRef.current?.sync(); },
        repositories: state?.userId === user?.id ? (state?.repositories ?? null) : null,
        error: state?.userId === user?.id ? (state?.error ?? null) : null,
        retry: () => {
          setState(null);
          setAttempt((n) => n + 1);
        },
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
export function useData() {
  return useContext(DataContext);
}
