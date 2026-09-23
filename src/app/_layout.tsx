import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/state/auth-store';
import { DataProvider } from '@/features/app/data-context';
import { colors } from '@/constants/theme';
import { Loading, Screen } from '@/components/ui';

void SplashScreen.preventAutoHideAsync().catch(() => {});
export default function RootLayout() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);
  useEffect(() => initialize(), [initialize]);
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {loading ? (
        <Screen>
          <Loading />
        </Screen>
      ) : (
        <DataProvider key={session?.user.id ?? 'signed-out'}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="auth/callback" />
            <Stack.Protected guard={!session}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={!!session}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding/index" />
              <Stack.Screen name="plan/edit" />
              <Stack.Screen name="workout/[sessionId]" />
              <Stack.Screen name="workout/exercise/[sessionExerciseId]" />
              <Stack.Screen name="workout/summary/[sessionId]" />
              <Stack.Screen name="history/[sessionId]" />
              <Stack.Screen name="history/exercise/[sessionExerciseId]" />
            </Stack.Protected>
          </Stack>
        </DataProvider>
      )}
    </SafeAreaProvider>
  );
}
