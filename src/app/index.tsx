import { Redirect } from 'expo-router';
import { useCallback } from 'react';
import { Brand, Loading, Notice, Screen } from '@/components/ui';
import type { Repositories } from '@/db/repositories';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useAuthStore } from '@/state/auth-store';
export default function Index() {
  const session = useAuthStore((s) => s.session);
  const { data, error, reload } = useLocalQuery(
    useCallback((r: Repositories) => r.plans.get(), []),
  );
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (data !== undefined) return <Redirect href={data ? '/home' : '/onboarding'} />;
  return (
    <Screen>
      <Brand />
      {error ? (
        <Notice error message={error} onRetry={() => void reload()} />
      ) : (
        <Loading />
      )}
    </Screen>
  );
}
