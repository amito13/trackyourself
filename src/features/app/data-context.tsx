import type { Repositories } from '@/db/repositories';
import { useAuthStore } from '@/state/auth-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface DataState {
  repositories: Repositories | null;
  error: string | null;
  retry: () => void;
}
const DataContext = createContext<DataState>({
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
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const currentUser = user;
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
  }, [user, attempt]);
  return (
    <DataContext.Provider
      value={{
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
