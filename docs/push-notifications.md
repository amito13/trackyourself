# Push notification registration

Run `src/db/migrations/003_expo_push_token.sql` in the Supabase SQL Editor
before testing. This adds `public.users.expo_push_token` and allows authenticated
users to update it under the existing profile ownership policies. No service-role
key is used by the app.

After sign-in (including a restored session), the root layout requests notification
permission and saves the Expo push token to the signed-in user's profile. Android's
`default` channel is created before requesting permission. Denied permission is
handled without blocking the app. Registration retries on foreground and native
token changes. Web and Expo Go skip registration.

Use an installed development or production build configured with FCM/APNs push
credentials and the EAS project ID. For Android, configure Firebase and the
`android.googleServicesFile` in app.json before rebuilding; configure the matching
FCM V1 credentials in EAS. The development package has a `.dev` suffix and needs
matching Firebase configuration. See the Expo setup guide below.

Verify on a device:
1. Sign in and accept the notification permission prompt.
2. Confirm that your row in `public.users` contains an `ExpoPushToken[...]` or
   `ExponentPushToken[...]` value in `expo_push_token`.
3. Deny permission on a fresh install and confirm sign-in still works.
4. Restore permission in system settings and return to the app; confirm registration.
5. Try an offline launch, reconnect, and foreground the app to retry.

This stores the latest device token per user. It is registration only: sending
notifications, multi-device delivery, and removal of stored tokens on logout are
not implemented. A sender should remove invalid tokens reported by push receipts.

References:
- https://docs.expo.dev/push-notifications/push-notifications-setup/
- https://docs.expo.dev/versions/v55.0.0/sdk/notifications/
