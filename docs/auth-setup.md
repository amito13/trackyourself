# OAuth setup

Account deletion requires applying `src/db/migrations/006_delete_account.sql`
in the Supabase SQL Editor as postgres after the existing migrations. The Profile
tab calls `delete_account()` only after confirmation. This function accepts no
user ID, derives the account from `auth.uid()`, and atomically removes its workout
data and Auth account. Anonymous callers cannot execute it. The app then clears
the account's local workout data and signs out on this device.

Validate in a test Supabase project using two accounts: cancel must preserve data;
confirm must remove the first account from Authentication and its owned rows,
including notification deliveries, while preserving the second account. An
offline request must show an error and retain the account and local changes.

In Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, add
`trackyourself://auth/callback` (preview/production) and
`trackyourself-dev://auth/callback` (development), then save. An unapproved redirect can fall back to
the project's Site URL, commonly `http://localhost:3000`; on a phone that URL
cannot return to this app.

In the Google OAuth client, the authorized redirect URI should be the Supabase
callback: `https://<project-ref>.supabase.co/auth/v1/callback`. Google returns to
Supabase first; Supabase then redirects to the app URL above.

Test with the installed development build using
`APP_VARIANT=development bunx expo start --dev-client --clear`.
The variant must match the installed app so the callback returns to the app that
stored the PKCE verifier. Start a fresh sign-in after changing the redirect; old
callback links cannot recover a missing verifier.
The development build must include the `trackyourself-dev` scheme from app.config.js
and expo-crypto; preview/production use `trackyourself`.
If either was added after the build was created, rebuild the development client.

After signing in, verify that the browser closes and the app opens the index
screen. OAuth requests should use `code_challenge_method=s256`. Also test canceling
sign-in and denying consent; neither should leave the sign-in button loading.

References:
- https://supabase.com/docs/guides/auth/redirect-urls
- https://docs.expo.dev/versions/v55.0.0/sdk/auth-session/
- https://docs.expo.dev/versions/v55.0.0/sdk/crypto/
