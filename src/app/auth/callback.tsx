import { useAuthStore } from '@/state/auth-store';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Brand, Button, Loading, Notice, Screen } from '@/components/ui';
import { ui } from '@/constants/theme';
import { errorMessage } from '@/utils/display';
export default function AuthCallbackScreen() {
  const handleDeepLink = useAuthStore((s) => s.handleDeepLink);
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let active = true;
    void handleDeepLink(url)
      .then(() => {
        if (active) router.replace('/');
      })
      .catch((error) => {
        if (active) setError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [handleDeepLink, url]);
  return (
    <Screen>
      <Brand />
      <Text style={ui.title}>Getting you{'\n'}back to training.</Text>
      {error ? (
        <>
          <Notice error message={error} />
          <Button title="Back to sign in" onPress={() => router.replace('/')} />
        </>
      ) : (
        <Loading />
      )}
    </Screen>
  );
}
