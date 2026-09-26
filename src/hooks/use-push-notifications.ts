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
      let stage = 'notification permissions';
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

        stage = 'getting Expo push token';
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled) return;
        stage = 'checking signed-in session';
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (cancelled || session?.user.id !== userId) return;

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (cancelled || !user || user.id !== userId) return;

        stage = 'finding the signed-in user profile';
        const { data: profile, error: profileError } = await supabase.from('users')
          .select('id').eq('id', user.id).maybeSingle();
        if (profileError) throw profileError;
        if (cancelled) return;
        if (!profile) {
          const host = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL!).hostname;
          throw new Error(`No visible public.users row for auth user ${user.id} on ${host}. Check this exact user in this Supabase project.`);
        }

        stage = 'saving token to Supabase';
        const { data, error } = await supabase.from('users')
          .update({ expo_push_token: token })
          .eq('id', userId)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Profile is readable, but the update returned no row. Check UPDATE policy roles and database triggers.');
      } catch (error) {
        // Do not log the push token or interrupt sign-in on network/permission errors.
        if (!cancelled) {
          // PostgREST errors are plain objects, not necessarily Error instances.
          const message = error && typeof error === 'object' && 'message' in error
            ? String(error.message) : 'Unknown registration error';
          const code = error && typeof error === 'object' && 'code' in error
            ? ` (${String(error.code)})` : '';
          const safeMessage = message.replace(/(?:ExponentPushToken|ExpoPushToken)\[[^\]]+\]/g, '[redacted token]');
          console.warn(`Push notification registration failed while ${stage}${code}: ${safeMessage}`);
        }
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
