import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { Repositories } from '@/db/repositories';
import { useData } from '@/features/app/data-context';

/** Pass a useCallback loader; reload when focus returns from an editing screen. */
export function useLocalQuery<T>(load: (repositories: Repositories) => Promise<T>) {
  const { repositories, error: databaseError, retry } = useData();
  const [state, setState] = useState<{ owner: Repositories; data: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const reload = useCallback(async () => {
    if (!repositories) return;
    const request = ++version.current;
    setLoading(true);
    setError(null);
    try {
      const data = await load(repositories);
      if (request === version.current) setState({ owner: repositories, data });
    } catch (error) {
      if (request === version.current)
        setError(
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
        );
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [load, repositories]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        version.current++;
      };
    }, [reload]),
  );
  return {
    data: state?.owner === repositories ? state?.data : undefined,
    error: databaseError ?? error,
    loading: loading || !repositories,
    reload: databaseError ? async () => retry() : reload,
    repositories,
  };
}
