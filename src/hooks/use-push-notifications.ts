import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from '@/lib/supabase';

// One token per user: signing in on another device replaces the previous token.
export function usePushNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!userId || Platform.OS === 'web' ||
        Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

    let cancelled = false;
    let registering = false;
    let tokenSubscription: { remove: () => void } | undefined;

    async function register() {
      if (cancelled || registering) return;
      registering = true;
      try {
        const Notifications = await import('expo-notifications');
        if (cancelled) return;
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        let permission = await Notifications.getPermissionsAsync();
        const allowed = () => permission.granted ||
          permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
        if (!allowed() && permission.canAskAgain) {
          permission = await Notifications.requestPermissionsAsync();
        }
        if (cancelled || !allowed()) return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        if (!projectId) throw new Error('Missing EAS project ID for push notifications.');

        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled) return;
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (cancelled || session?.user.id !== userId) return;

        const { data, error } = await supabase.from('users')
          .update({ expo_push_token: token })
          .eq('id', userId)
          .select('id')
          .single();
        if (error) throw error;
        if (!data) throw new Error('User profile missing while saving push token.');
      } catch (error) {
        // Do not log the push token or interrupt sign-in on network/permission errors.
        if (!cancelled) console.warn('Push notification registration failed:',
          error instanceof Error ? error.message : 'Could not save the token. Check the database migration and push credentials.');
      } finally {
        registering = false;
      }
    }

    void register();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void register();
    });
    void import('expo-notifications').then((Notifications) => {
      if (!cancelled) {
        // Native token changes require fetching a new Expo token, not saving the native token.
        tokenSubscription = Notifications.addPushTokenListener(() => { void register(); });
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
      appStateSubscription.remove();
      tokenSubscription?.remove();
    };
  }, [userId]);
}
