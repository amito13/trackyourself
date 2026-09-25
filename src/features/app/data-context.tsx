import { AppState } from 'react-native';
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import { createSyncController, type SyncState } from '@/db/sync/controller';
import { uploadPending } from '@/db/sync/upload';
import { supabase } from '@/lib/supabase';
import type { Repositories } from '@/db/repositories';
import { useAuthStore } from '@/state/auth-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface DataState {
  repositories: Repositories | null;
  error: string | null;
  retry: () => void;
  sync: SyncState;
}
const DataContext = createContext<DataState>({
  sync: { status: 'pending', pending: 0, error: null, lastSyncedAt: null },
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
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    let cancelled = false;
    const load = async () => {
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
    };
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
    controller.setActive(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    let disposed = false;
    let receivedNetworkEvent = false;
    const network = addNetworkStateListener((value) => {
      receivedNetworkEvent = true;
      controller.setOnline(value.isConnected !== false && value.isInternetReachable !== false);
    });
    void getNetworkStateAsync().then((value) => {
      if (!disposed && !receivedNetworkEvent) controller.setOnline(value.isConnected !== false && value.isInternetReachable !== false);
    }).catch(() => { if (!disposed && !receivedNetworkEvent) controller.setOnline(true); });
    const appState = AppState.addEventListener('change', (value) => controller.setActive(value === 'active'));
    return () => {
      disposed = true;
      controller.stop();
      network.remove();
      appState.remove();
    };
  }, [state, user?.id]);
  return (
    <DataContext.Provider
      value={{
        sync,
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
