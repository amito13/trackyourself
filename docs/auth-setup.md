# OAuth setup

In Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, add
`trackyourself://auth/callback` and save. An unapproved redirect can fall back to
the project's Site URL, commonly `http://localhost:3000`; on a phone that URL
cannot return to this app.

In the Google OAuth client, the authorized redirect URI should be the Supabase
callback: `https://<project-ref>.supabase.co/auth/v1/callback`. Google returns to
Supabase first; Supabase then redirects to the app URL above.

Test with the installed development build using `bunx expo start --dev-client --clear`.
The build must include the `trackyourself` scheme from app.json and expo-crypto.
If either was added after the build was created, rebuild the development client.

After signing in, verify that the browser closes and the app opens the index
screen. OAuth requests should use `code_challenge_method=s256`. Also test canceling
sign-in and denying consent; neither should leave the sign-in button loading.

References:
- https://supabase.com/docs/guides/auth/redirect-urls
- https://docs.expo.dev/versions/v55.0.0/sdk/auth-session/
- https://docs.expo.dev/versions/v55.0.0/sdk/crypto/
