# Local database and repositories

This step implements the SQLite persistence layer for Android/iOS. It does not
implement screens or the Supabase sync engine. The existing authentication flow
and cloud migration are unchanged.

`expo-sqlite` was installed using Expo's SDK-compatible installer. Rebuild an
existing development client to include its native module. Expo Go includes SQLite.
Web SQLite needs separate WASM/HTTP header configuration before using this layer
in a browser; that configuration is not included in this mobile persistence step.
See the [SDK 55 SQLite documentation](https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/).

## Entry point

Call `openRepositories(authenticatedUser.id)` from `src/db/sqlite/open.ts` after
sign-in. It lazily opens `track-yourself-<user UUID>.db`, enables foreign keys/WAL,
checks the schema version, and returns account-bound repositories. Use only the
repositories for application persistence; do not open additional connections or
issue raw queries outside the transaction queue.

First cache the authenticated identity with `profile.cacheIdentity`, then cache
Supabase exercise rows with `exercises.cache`. The library uses the actual cloud
UUIDs; do not invent local seed IDs that would fail cloud foreign-key checks.
Initial authentication and library download require connectivity. Once cached,
plan changes and workout operations below use SQLite only.

On logout, release the account's UI state and repository references. Do not delete
its database or pending queue. On account switches, acquire repositories for the
new authenticated UUID. The files and local ownership triggers isolate accounts;
this is not encrypted storage or a substitute for Supabase RLS.

## Available operations

- `profile`: cache identity, read profile, edit name/avatar.
- `exercises`: cache downloaded library rows, search/filter cached exercises.
- `plans`: atomically save a complete weekly plan, read its days/exercises.
- `workouts`: resolve today's plan, start/resume, add exercises/sets, save partial
  or complete sets, remove sets, skip/complete exercises, reorder, explicitly finish.
- `history`: paginate sessions, read a session/summary, compare an exercise with
  its most recent qualifying completed performance before that session.
- `pending`: list pending records, capture revision-checked snapshots, acknowledge
  only the exact successfully uploaded revision.

All repository methods return promises except input validation can throw before
returning one. Catch both by calling them inside `try { await ... } catch (...)`.
UI forms should keep entered values visible if persistence fails.

## Behavior

One local active workout is resumed before considering today's schedule, including
on a rest day. New sessions are allowed only on a configured day and only once per
local calendar date. Multiple body parts are supported. Plan edits retain old
configuration rows as tombstones and preserve active/completed session snapshots.

New exercise fields are blank. Previous set count can determine the number of
empty rows, but previous values are never copied. Each set persists independently;
missing fields stay null. Complete numeric inputs mark a set complete. A session
only finishes through `workouts.finish`. Blank/partial rows remain in history and
do not qualify as completed performance. Skipped exercises are excluded from
previous-performance lookup even if they retain entered sets.

Removing a set leaves a tombstone and stable set numbers; numbers may have gaps.
Render those numbers consistently in the UI. New sets never reuse removed numbers.
Completed workouts cannot be changed through these repositories.

The queue and record mutation commit together. Every new mutation increments the
record's queue revision. Acknowledging an older revision does not clear a newer
edit. Queue order is not upload order: the future sync engine must respect parent
relationships, tombstones before conflicting replacements, profile update-only
privileges, and the cloud completion protocol in `database-setup.md`. Serialize
SQLite booleans as PostgreSQL booleans and decode `body_parts` JSON for uploads.
Downloads must preserve dirty local records rather than overwriting them.

## Validation

Run `bun test tests/db`, `bunx expo lint`, and `bunx tsc --noEmit`.
The tests execute the production schema/repository queries with Bun's real SQLite
engine. They cover file reopening/resume, blanks/timers, previous performance,
historical snapshots, account isolation, rollback, concurrent operations, queue
revision races, and foreign-key/integrity checks. Native Expo bridge/device testing
and end-to-end Supabase sync testing remain separate integration steps.
