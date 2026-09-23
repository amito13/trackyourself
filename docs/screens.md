# Mobile screens

The screens use a shared charcoal/orange theme in `src/constants/theme.ts` and
accessible controls in `src/components/ui`. No new dependencies or native
configuration changes were introduced by this screen implementation.

## Flow

- Google-only sign-in retains the existing Supabase OAuth implementation.
- The entry route opens account-specific repositories and checks for a local plan.
- `/onboarding` has three steps: training days, body parts per day, and exercises
  per day. The exercise library is downloaded on request and cached for offline use.
- `/home`, `/history`, and `/profile` form the three primary tabs.
- Home shows the weekly schedule, today's plan, rest state, completed state, or a
  saved active workout. Resume takes precedence over today's schedule.
- `/workout/[sessionId]` lists exercises and allows additional library exercises.
- `/workout/exercise/[sessionExerciseId]` compares previous values with blank current
  inputs, handles rep/duration and bodyweight sets, and saves valid edits locally.
- Finishing a workout requires an explicit confirmation; the summary shows actual
  completed exercises/sets and elapsed minutes.
- History includes session details and read-only exercise comparisons.
- `/plan/edit` reuses the three-step editor and preserves historical sessions.

## Data and limitations

This is a working local UI integration, not a cloud sync implementation. The profile
screen explicitly notes pending local data; it does not claim uploads succeeded.
A new device cannot restore an existing cloud plan/history until the sync integration
is implemented. Authentication and the initial library download require connectivity.

Library fetching uses the existing Supabase URL/key environment variables. There
are no fabricated users, workout histories, or uploaded exercise IDs in the app.

SQLite is initialized lazily by `DataProvider` after authentication. Use an Android
or iOS development client with the installed SQLite/network modules. The screen
changes are JavaScript-only and can load from Metro after the in-progress build is
installed. Browser SQLite setup is outside this mobile screen task.

## Device review

Check the flow on both a small phone and a larger screen, including numeric keyboard
visibility, large text settings, Google callback, offline relaunch, and resume after
midnight. Autosave errors keep typed fields visible and block navigation until the
set saves successfully. Confirm that completing an exercise alone never finishes
the session and that completed history remains read-only.

Validation performed: Android production bundle, lint, TypeScript route checks,
and existing SQLite repository tests. Live visual/device review remains outstanding.
