# Scheduled push notifications

The backend lives in this repository and runs on Supabase. No Express server or
VPS is needed. The daily send time is **21:00 Asia/Kolkata (15:30 UTC)**.

Each eligible user receives one preset message per daily occurrence. Messages
rotate by ID and wrap back to the first active message. The user's name replaces
`{name}`; a missing name becomes "Athlete". Five starter messages are seeded.
The rotation advances when a daily delivery is queued, including failed deliveries.

## Deploy

Prerequisites: existing schema migrations 001 and 003, working Expo credentials,
and at least one real device token in `public.users.expo_push_token`.

1. Run `src/db/migrations/004_scheduled_notifications.sql` once in the Supabase
   SQL Editor. This is an additive migration; it creates the templates, global
   schedule, private delivery log, and service-role-only claim function.
   This project uses SQL Editor migrations; do not run `supabase db push`
   expecting it to apply files from `src/db/migrations`.
2. Generate a long random secret (for example with a password manager). In
   Supabase **Edge Functions → Secrets**, save it as `NOTIFICATION_CRON_SECRET`.
   Do not put it in `EXPO_PUBLIC_*`, Git, app code, or this document.
   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function.
   If Expo enhanced push security is enabled, also set `EXPO_ACCESS_TOKEN`.
3. Authenticate the CLI and deploy from the repository root:

   ```bash
   bunx supabase login
   bunx supabase functions deploy send-reminders --project-ref YOUR_PROJECT_REF
   ```

   Find the project ref in Supabase project settings. `supabase/config.toml`
   disables gateway JWT validation for this function because its handler checks
   the private scheduler bearer secret instead. An app publishable/anon key
   cannot invoke the worker.
4. In **Supabase Vault**, create:
   - `notification_project_url`: your `https://YOUR_PROJECT_REF.supabase.co` URL,
     without a trailing slash.
   - `notification_cron_secret`: the exact same secret from step 2.
5. Run `supabase/schedule-reminders.sql` in the SQL Editor. It enables
   `pg_cron`/`pg_net` and creates the named cron job. Re-running the script
   updates that job.

The cron runs every minute for due reminders, retries, and delivery receipts.
The SQL function only creates daily reminders between 21:00 and 21:15 India time,
allowing a short catch-up window after a delayed invocation. Stored tokens receive
these reminders even if the app is closed. Push arrival is not guaranteed to be
exactly 21:00.

## Edit messages and schedule

Use the Supabase Table Editor for `notification_messages`. Change title/body,
add rows, or set `active = false`. Use `{name}` anywhere in either field.
Keep messages short. Deactivate used templates instead of deleting them because
delivery history references them. If every message is inactive, no new reminders
are queued. Changes affect future deliveries; queued payloads are snapshots.

Change the single row in `notification_schedule` to adjust `local_time` and
`timezone` (a valid IANA name such as Asia/Kolkata). Set `enabled = false`
to pause enqueueing and sending. An already claimed request may finish.

## Verify and monitor

First test in a staging Supabase project with your own device token. Temporarily
set its schedule to a few minutes ahead in the configured timezone, wait for cron,
and inspect `notification_deliveries`. Do not change the production time to test
unless you intend to notify every eligible user.

- `pending`: queued or waiting for a known transient failure retry.
- `sending`: claimed by a worker.
- `accepted`: Expo returned a ticket; device delivery is not yet confirmed.
- `delivered`: receipt confirms handoff to FCM/APNs, not display on the phone.
- `failed`: a permanent error, exhausted retries, or an expired reminder.
- `unknown`: an interrupted/ambiguous send or a missing receipt.

Check Supabase Edge Function logs for HTTP errors. Cron's SQL execution succeeding
only means the HTTP request was queued; check Edge Function invocation status
and `net._http_response` for the HTTP outcome too.

## Reliability and limits

- Daily uniqueness plus transactional claiming prevents concurrent cron calls
  from claiming the same reminder. Exactly-once device delivery is not guaranteed.
- HTTP 429/5xx and Expo rate errors retry after 1 then 2 minutes, up to 3 attempts.
  Network timeouts and malformed success responses are marked unknown rather than
  blindly resent, since Expo might already have accepted the payload.
- Workers interrupted for more than 5 minutes become unknown. Pending reminders
  older than 30 minutes expire, avoiding a late backlog of old messages.
- Receipts are first checked after 15 minutes and then periodically. Missing
  receipts become unknown after 23 hours. DeviceNotRegistered removes only the
  exact token used for that send, preserving a newer token.
- This initial worker processes up to 100 queued sends and 100 receipt checks per
  minute. Large audiences will be staggered and need increased worker capacity;
  monitor pending counts before approaching a few thousand users.
- The existing registration stores one token per user. Multi-device delivery,
  logout token removal, and an in-app reminder opt-out are not implemented.
  Token/permission changes are handled by existing registration and Expo receipts.
- Delivery rows contain tokens and personalized copy and are backend-only.
  Define retention/archival as the app grows; retain the latest delivery per user
  to preserve message rotation.

## Local checks

```bash
bunx expo lint
bunx tsc --noEmit
bunx deno check supabase/functions/send-reminders/index.ts
bunx deno test --allow-env supabase/functions/send-reminders/handler_test.ts
node --test tests/notifications.test.mjs
```

For real SQL behavior in an isolated PostgreSQL engine (no live database):

```bash
npm install --prefix /tmp/track-notification-validation --no-audit --no-fund --ignore-scripts @electric-sql/pglite
PGLITE_MODULE=/tmp/track-notification-validation/node_modules/@electric-sql/pglite/dist/index.js node --test tests/notification-database.test.mjs
```

The temporary dependency is a test tool; it is not installed in the Expo app.
The SQL test does not emulate Supabase Vault, pg_cron or pg_net; verify those
integrations after deployment.

References:
- https://supabase.com/docs/guides/functions/schedule-functions
- https://supabase.com/docs/guides/functions/deploy
- https://docs.expo.dev/push-notifications/sending-notifications/
