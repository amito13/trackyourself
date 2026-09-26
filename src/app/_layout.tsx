import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SystemUI from 'expo-system-ui';
import { useAppearance } from '@/state/appearance-store';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/state/auth-store';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { DataProvider } from '@/features/app/data-context';
import { useTheme } from '@/constants/theme';
import { Loading, Screen } from '@/components/ui';

void SplashScreen.preventAutoHideAsync().catch(() => {});
export default function RootLayout() {
  const { colors, mode } = useTheme();
  const { hydrated, hydrate } = useAppearance();
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);
  usePushNotifications(loading ? undefined : session?.user.id);
  useEffect(() => initialize(), [initialize]);
  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => {
    if (!hydrated) return;
    Appearance.setColorScheme(mode);
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [mode, colors.background, hydrated]);
  useEffect(() => {
    if (!loading && hydrated) void SplashScreen.hideAsync().catch(() => {});
  }, [loading, hydrated]);
  const baseTheme = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors, primary: colors.accent, background: colors.background,
      card: colors.surface, text: colors.text, border: colors.border, notification: colors.accent,
    },
  };
  if (!hydrated) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
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
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
