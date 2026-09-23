# Supabase database setup

1. Open your project's **SQL Editor** in Supabase.
2. Paste the entire contents of `src/db/migrations/001_initial_schema.sql`.
3. Run it once. The migration uses a transaction, creates nine application tables,
   enables row-level security, installs triggers, and seeds 46 exercises.

This is an initial migration, not an upgrade of existing application tables. If
tables with these names already exist, inspect and reconcile their schema first.
It intentionally fails instead of silently accepting an incompatible schema.
It does not change Google OAuth configuration or require credentials in SQL.

New Supabase Auth users receive a profile automatically. Existing Auth users are
backfilled. `users.id` and `users.auth_user_id` both equal the Supabase Auth UUID.
Use that UUID for every user-owned row's `user_id`.

## Data conventions

- Weekdays use ISO numbering: Monday `1` through Sunday `7`.
- Generate UUIDs on the device before persisting new local records. Server UUID
  defaults are a fallback, not the mobile sync identity strategy.
- Store `workout_date` as the device-local date when the workout starts.
- Snapshot session `title`/`body_parts` and exercise name, muscle group, and tracking
  type when creating a workout. History must read these snapshots.
- Sets record either reps or duration in seconds. Bodyweight sets have null weight.
  Unfilled inputs remain null; partial sets must have `completed = false`.
- Finishing a workout may retain partial sets. Previous-performance queries should
  select a completed session started before the current session, a non-deleted
  completed exercise, and at least one non-deleted completed set. Display partial
  historical rows as blanks; never treat them as completed performance.
- Completed sessions and their children are read-only to the mobile client.
- The shared exercise library is readable by authenticated users and writable only
  administratively. Custom exercises are outside this MVP.

## Synchronization contract

SQLite and its pending-operation queue still need implementation. SQL alone does
not synchronize devices. Keep `sync_status` locally, not in shared cloud records.

Upload configuration in parent-first order: plan, days, body-part/exercise mappings.
Only one non-deleted active plan is allowed per user; deactivate an old plan before
activating its replacement. Update existing plans in place for ordinary edits.

For each workout:

1. Insert its session with `status = 'active'` and null `completed_at`, even if the
   local workout has already finished.
2. Upload session exercises, then sets, including deletions represented by tombstones.
3. After every child operation succeeds, update the session to `completed` with
   its original local completion timestamp.

Resume interrupted uploads by UUID. If a completion request loses its response,
read the remote session before retrying: completed sessions reject further writes.
Do not upsert a completed session and its children on every sync. Only acknowledge
local pending changes after verifying success; retain conflicting local data.

Use `deleted_at` for removals from mutable configuration or active workouts. Clients
have no hard-delete permission. Tombstone dependent mappings/sets as appropriate;
soft deletion is not an automatic cascade. Keep referenced plan days and library
entries so historical foreign keys remain valid.

`updated_at` is server-assigned on updates. Configuration conflicts currently use
last accepted server write, not device-clock ordering. Pull all owned records,
including tombstones, for MVP restoration; a naive timestamp-only incremental
cursor can miss concurrent transactions. Merge downloads without overwriting
pending local changes. This schema does not implement a conflict-resolution RPC.

Resume active workouts locally. The database intentionally permits multiple
offline-created sessions from different devices, including on the same date, so
uploading cannot discard recorded data. The app must reconcile active sessions
after downloading. Scheduled-day checks and resume behavior belong in the app;
upload must accept a workout after the user's schedule has subsequently changed.

## Verification

Lint and TypeScript checks validate the existing app, not PostgreSQL execution.
This migration has not been executed against a PostgreSQL/Supabase instance here.
After installation, verify with two separate authenticated accounts that each can
only read/write its own records, anonymous access is denied, active partial sets
save successfully, and completed sessions reject edits to themselves and children.

Reference: [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [Auth user profiles](https://supabase.com/docs/guides/auth/managing-user-data).
