# PRD — Offline-First Gym Progressive Overload Tracker

**Document type:** Product Requirements Document
**Target:** Codex implementation
**Platform:** React Native / Expo
**Backend:** Supabase directly from mobile client
**Architecture:** Offline-first
**Primary objective:** Track workout performance and help users improve against their most recent performance.

---

## 1. Product Overview

Build a mobile gym self-tracking application focused on one core problem:

> **A user should always know what they performed last time and be able to record what they perform today.**

Users often forget the weight and repetitions they performed during their previous workout. This application stores each workout at the **set level** and displays the user's most recent performance when the exercise appears again.

The product is intentionally **not** a workout recommendation application.

The user defines their own:

* workout days;
* body-part split;
* exercises;
* number of sets;
* weight;
* repetitions.

The application primarily provides:

**Plan → Perform → Record → Compare → Improve**

---

# 2. MVP Success Criteria

A user must be able to:

1. Sign in using Google.
2. Complete workout onboarding.
3. Select specific workout days.
4. Assign one or more body parts to each workout day.
5. Select exercises for those body parts.
6. Open the application and see today's workout automatically.
7. Start today's workout.
8. Record sets, reps and weight.
9. See their most recent performance for each exercise.
10. Add/remove sets during the workout.
11. Skip/add exercises during the workout.
12. Explicitly finish the workout.
13. Access previous workouts.
14. Compare current and previous exercise performance.
15. Edit their future workout plan without changing historical workouts.
16. Use workout functionality offline.
17. Synchronize local changes with Supabase when connectivity returns.

---

# 3. Technical Requirements

Use the existing Expo project rather than recreating the application unnecessarily.

The intended architecture is:

```text
React Native / Expo
        │
        ├── Expo Router
        │
        ├── Zustand
        │
        ├── Local SQLite
        │
        └── Supabase
              │
              ├── Google Authentication
              └── PostgreSQL
```

Do **not** introduce a Node.js/Express backend.

The mobile application communicates directly with Supabase.

Do not introduce unnecessary libraries or abstraction layers.

---

# 4. Offline-First Architecture

Offline support is an MVP requirement.

The application must not require a network connection while the user is performing a workout.

The preferred data flow is:

```text
                  MOBILE APP
                      │
                      ▼
               LOCAL SQLITE DB
                      │
             ┌────────┴────────┐
             │                 │
        UI reads/writes    Sync Engine
             │                 │
             │                 ▼
             │             SUPABASE
             │            PostgreSQL
             │
             ▼
       Instant local UI
```

## Core principle

For workout-related operations:

> **SQLite is the immediate operational data source. Supabase is the synchronized cloud source.**

Example:

```text
User enters:

Bench Press
60 kg × 10

        ↓

Write to SQLite immediately

        ↓

UI updates

        ↓

Is internet available?

      ┌───────┴────────┐
      │                │
     YES               NO
      │                │
      ▼                ▼
 Sync Supabase     Mark pending
      │                │
      ▼                │
    synced             │
                       ▼
                Internet returns
                       │
                       ▼
                 Sync Supabase
```

A network failure must **never destroy or block a workout being logged locally**.

---

# 5. Authentication

MVP authentication method:

**Google only**

Use:

**Supabase Auth + Google OAuth**

Do not implement:

* email/password authentication;
* phone authentication;
* Apple authentication;
* guest authentication.

After successful Google authentication, ensure a corresponding application user record exists.

---

# 6. First-Time User Flow

After authentication, determine whether the user has completed onboarding.

```text
Google Login
     │
     ▼
Existing configured user?
     │
 ┌───┴────┐
 │        │
YES       NO
 │        │
 ▼        ▼
Home    Onboarding
```

Onboarding consists of **three primary questions**.

---

# 7. Onboarding — Step 1

## Select Workout Days

Do NOT ask:

> How many days per week do you train?

Instead ask the user directly which days they train.

Example:

```text
Which days do you work out?

[✓] Monday
[✓] Tuesday
[✓] Wednesday
[✓] Thursday
[✓] Friday
[ ] Saturday
[ ] Sunday

              Continue →
```

At least one workout day must be selected.

---

# 8. Onboarding — Step 2

## Assign Body Parts

Each selected workout day can contain **multiple body parts**.

Example:

```text
MONDAY

What are you training?

[✓] Chest
[✓] Triceps
[ ] Back
[ ] Biceps
[ ] Shoulders
[ ] Legs
[ ] Core
```

Example resulting plan:

```text
Monday
Chest + Triceps

Tuesday
Back + Biceps

Wednesday
Legs

Thursday
Shoulders + Triceps

Friday
Chest + Back
```

Body-part options should be easy to extend later.

---

# 9. Onboarding — Step 3

## Select Exercises

Exercises come from the database exercise library.

Example:

```text
CHEST

Search exercises...

☑ Bench Press
☑ Incline Dumbbell Press
☐ Decline Bench Press
☑ Cable Fly
☐ Pec Deck
☑ Chest Dips
```

Repeat for every selected body part/day.

Do **not** ask the user for sets/reps/weight during onboarding.

The user defines actual sets during their first workout.

---

# 10. Exercise Library

Seed Supabase with a reasonable starter exercise library.

Minimum body-part categories:

```text
Chest
Back
Shoulders
Biceps
Triceps
Legs
Core
```

Include common exercises.

Example:

```text
Chest
├── Bench Press
├── Incline Bench Press
├── Incline Dumbbell Press
├── Decline Bench Press
├── Dumbbell Press
├── Cable Fly
├── Pec Deck
├── Push Up
└── Chest Dips

Back
├── Lat Pulldown
├── Pull Up
├── Barbell Row
├── Dumbbell Row
├── Seated Cable Row
└── Deadlift

Legs
├── Barbell Squat
├── Leg Press
├── Leg Extension
├── Leg Curl
├── Romanian Deadlift
└── Calf Raise
```

Create sensible entries for the remaining muscle groups.

Simple suitable exercise imagery/icons/placeholders may be used.

Do not make external image sourcing a blocker for MVP functionality.

---

# 11. Main Navigation

Use three primary tabs:

```text
┌──────────────┬──────────────────┬──────────────┐
│     HOME     │  PREVIOUS DATA   │   PROFILE    │
└──────────────┴──────────────────┴──────────────┘
```

Use Expo Router.

---

# 12. Home Screen

Home should prioritize **today's workout**.

Recommended hierarchy:

```text
Hey,
Amit 👋

────────────────────────

TODAY'S WORKOUT

Monday

Chest + Triceps

6 exercises

Bench Press
Incline Dumbbell Press
Cable Fly
Chest Dips
Tricep Pushdown
Skull Crushers

[ START WORKOUT ]

────────────────────────

YOUR PROGRESS

     Coming Soon

────────────────────────

Home      Previous Data      Profile
```

The visual design may improve on the supplied mockups.

Maintain:

* dark theme;
* strong gym/fitness identity;
* orange accent;
* clear hierarchy;
* large touch targets;
* mobile-first layout;
* restrained visual clutter.

---

# 13. Rest Day Home State

If today isn't one of the user's configured workout days:

```text
Hey, Amit 👋

TODAY

REST DAY

Recovery is part of progress.

Next Workout

Thursday
Shoulders + Triceps
```

Do not create fake workout sessions on rest days.

---

# 14. Starting a Workout

Pressing:

**Start Workout**

creates a local `workout_session`.

The screen should display today's planned exercises.

Example:

```text
CHEST + TRICEPS

1. Bench Press
2. Incline Dumbbell Press
3. Cable Fly
4. Chest Dips
5. Tricep Pushdown
6. Skull Crushers
```

The user can enter each exercise.

---

# 15. Exercise Logging — Most Important Screen

This is the core experience of the product.

When opening an exercise, retrieve the user's **most recent completed performance for that exercise**.

Example:

```text
BENCH PRESS

Last performed:
16 Sep

LAST TIME                    TODAY

Set 1
60 kg × 10                  [ kg ] [ reps ]

Set 2
60 kg × 8                   [ kg ] [ reps ]

Set 3
55 kg × 10                  [ kg ] [ reps ]

Set 4
50 kg × 12                  [ kg ] [ reps ]


+ Add Set


[ COMPLETE EXERCISE ]
```

The previous values are **reference only**.

Today's fields should initially be empty.

Do not automatically claim the user performed the previous values.

---

# 16. Definition of “Previous Performance”

Previous performance means:

> The most recent completed workout session before the current session containing that exercise.

It does **not necessarily mean exactly seven days ago**.

Example:

```text
Sep 01 → Bench Press
Sep 08 → Bench Press
Sep 15 → skipped
Sep 22 → current workout
```

For Sep 22, previous performance is:

**Sep 08**

because that is the most recent completed Bench Press performance.

Retrieve **all sets belonging to that exercise performance**.

---

# 17. First-Ever Exercise State

If the user has never performed the exercise before:

```text
BENCH PRESS

First time performing this exercise.

SET     WEIGHT (KG)     REPS

1       [       ]       [    ]

+ Add Set

[ COMPLETE EXERCISE ]
```

No previous-performance section is necessary.

---

# 18. Dynamic Sets

Sets are not fixed during onboarding.

During the workout users can:

* add sets;
* remove sets;
* change weight;
* change reps.

Example:

```text
Set 1     60 kg     10
Set 2     60 kg      8
Set 3     55 kg     10

+ Add Set
```

Each individual set must be persisted independently.

---

# 19. Weight

MVP uses:

**Kilograms only.**

Do not build pound conversion/settings yet.

For exercises where external weight is not appropriate, allow a sensible bodyweight representation rather than requiring fake `0 kg` values.

Implementation may support something equivalent to:

```text
weight_type

weighted
bodyweight
```

Keep the UX simple.

---

# 20. Active Workout Flexibility

During an active workout, the user may:

* add a set;
* remove a set;
* skip an exercise;
* change exercise order if practical;
* add another exercise;
* change weight/reps;
* leave and return to the active workout.

The active session must survive app navigation and reasonable app restarts through SQLite persistence.

---

# 21. Finish Workout

Workout completion must be explicit.

Provide:

**Finish Workout**

Do not automatically finish because every planned exercise has data.

On Finish Workout:

1. persist remaining local data;
2. mark session completed;
3. store completion timestamp;
4. queue unsynchronized records;
5. sync if network is available;
6. show workout summary.

---

# 22. Workout Summary

Example:

```text
WORKOUT COMPLETE ✓

Chest + Triceps

6 exercises
18 sets
52 min

────────────────

Bench Press
4 sets

Incline Dumbbell Press
3 sets

Cable Fly
3 sets

...

[ DONE ]
```

Do not make calories a core metric because we are not collecting enough information to calculate them reliably.

---

# 23. Previous Data

The MVP Previous Data feature is:

```text
Workout History
      ↓
Select Workout
      ↓
View Exercises
      ↓
Select Exercise
      ↓
View Sets / Reps / Weight
      ↓
Compare with previous performance
```

Example:

```text
WORKOUT HISTORY

Mon, Sep 21
Chest + Triceps
6 exercises

Mon, Sep 14
Chest + Triceps
6 exercises

Tue, Sep 8
Back + Biceps
5 exercises
```

---

# 24. Workout History Detail

Example:

```text
MONDAY, SEP 21

Chest + Triceps

Bench Press
4 sets

Incline Dumbbell Press
3 sets

Cable Fly
3 sets

Chest Dips
3 sets
```

Selecting Bench Press:

```text
BENCH PRESS

SEP 21                 SEP 14

62.5 × 10              60 × 10
60   × 10              60 × 8
55   × 12              55 × 10
50   × 12              50 × 12
```

This comparison is one of the core product experiences.

---

# 25. Progress Graph

Advanced analytics are **not part of the MVP**.

Home can contain:

```text
YOUR PROGRESS

┌─────────────────────────┐
│                         │
│      Coming Soon        │
│                         │
└─────────────────────────┘
```

Do not spend implementation time building:

* sophisticated graphs;
* PR detection;
* training-volume analytics;
* streak algorithms;
* muscle distribution;
* calorie calculations.

They can be future features.

---

# 26. Profile Screen

MVP Profile includes:

```text
PROFILE

[Avatar]

Amit Dewangan
email@example.com

────────────────────

MY WORKOUT PLAN

Monday
Chest + Triceps

Tuesday
Back + Biceps

Wednesday
Legs

Thursday
Shoulders + Triceps

Friday
Chest + Back

────────────────────

[ EDIT WORKOUT PLAN ]

[ LOG OUT ]
```

Optional basic About/App Version entry is acceptable.

Do not implement notification settings yet.

---

# 27. Edit Workout Plan

Users can change:

* workout days;
* body parts;
* exercises.

Critical requirement:

> **Editing the current workout plan must never rewrite historical workouts.**

Example:

User originally had:

```text
Monday → Chest
```

They complete ten Chest sessions.

Later they change:

```text
Monday → Back
```

Those ten historical sessions must still display:

```text
Chest
Bench Press
Cable Fly
...
```

They must not suddenly become Back workouts.

Historical data represents what happened at that point in time.

---

# 28. Database Schema

Use Supabase PostgreSQL.

Core cloud schema:

```text
users
────────────────────────
id                uuid PK
auth_user_id      uuid UNIQUE
name              text
email             text
avatar_url        text
onboarding_done   boolean
created_at        timestamptz
updated_at        timestamptz


workout_plans
────────────────────────
id                uuid PK
user_id           uuid FK
name              text
is_active         boolean
created_at        timestamptz
updated_at        timestamptz


workout_days
────────────────────────
id                uuid PK
plan_id           uuid FK
day_of_week       integer
sort_order        integer


workout_day_body_parts
────────────────────────
id                uuid PK
workout_day_id    uuid FK
body_part         text


exercises
────────────────────────
id                uuid PK
name              text
muscle_group      text
image_url         text nullable
is_custom         boolean default false
created_by        uuid nullable
created_at        timestamptz


workout_day_exercises
────────────────────────
id                uuid PK
workout_day_id    uuid FK
exercise_id       uuid FK
sort_order        integer


workout_sessions
────────────────────────
id                uuid PK
user_id           uuid FK
workout_day_id    uuid nullable
workout_date      date
started_at        timestamptz
completed_at      timestamptz nullable
status            text
created_at        timestamptz
updated_at        timestamptz


session_exercises
────────────────────────
id                uuid PK
session_id        uuid FK
exercise_id       uuid FK
exercise_name     text
muscle_group      text
sort_order        integer
status            text
created_at        timestamptz


exercise_sets
────────────────────────
id                    uuid PK
session_exercise_id   uuid FK
set_number            integer
weight_kg             numeric nullable
reps                  integer
weight_type           text
completed             boolean
created_at            timestamptz
updated_at            timestamptz
```

Notice the addition of:

`workout_day_body_parts`

because one day can contain multiple body parts.

---

# 29. Historical Snapshot Requirement

Do not rely entirely on mutable plan information to display historical sessions.

At minimum, snapshot important historical values when creating/completing a workout.

For example, `session_exercises` stores:

```text
exercise_id
exercise_name
muscle_group
```

even though `exercise_id` points to the exercise library.

Consider snapshotting session title/body parts as well if necessary.

Historical screens must remain semantically correct after plan edits.

---

# 30. Database Relationships

```text
users
  │
  └── workout_plans
         │
         └── workout_days
               │
               ├── workout_day_body_parts
               │
               └── workout_day_exercises
                           │
                           ▼
                       exercises


users
  │
  └── workout_sessions
            │
            └── session_exercises
                       │
                       ├── exercises
                       │
                       └── exercise_sets
```

Use proper:

* primary keys;
* foreign keys;
* indexes;
* unique constraints;
* cascades where safe.

Be careful with destructive cascades involving historical workout records.

---

# 31. Row Level Security

Enable Supabase RLS for user-owned data.

A user must only be able to access their own:

* profile;
* workout plans;
* workout days;
* workout-day mappings;
* sessions;
* session exercises;
* sets.

The global exercise library can be readable by authenticated users.

Never rely solely on frontend filtering for ownership security.

Use Supabase's authenticated user ID to enforce ownership.

---

# 32. Local SQLite Model

Create corresponding local tables needed for:

* workout configuration;
* exercises;
* sessions;
* session exercises;
* sets.

Add synchronization metadata where appropriate.

For locally mutable records, consider:

```text
sync_status

synced
pending_create
pending_update
pending_delete
```

and:

```text
updated_at
```

Use stable UUIDs generated client-side so the same identifier can be used locally and remotely.

---

# 33. Synchronization

Implement a simple MVP synchronization system.

Do not build an unnecessarily complex distributed synchronization framework.

Required behavior:

```text
Local mutation
     ↓
SQLite transaction
     ↓
mark pending
     ↓
network available?
     │
    YES
     ↓
push to Supabase
     ↓
success?
 ┌───┴────┐
YES       NO
 │         │
 ▼         ▼
synced   remain pending
```

Retry pending operations when:

* application launches;
* application returns to foreground;
* connectivity becomes available;
* a reasonable explicit refresh occurs.

Sync failure should not delete local records.

---

# 34. Conflict Strategy

For MVP, prefer predictable behavior over sophisticated conflict resolution.

For ordinary user-owned mutable configuration, use `updated_at` and a simple last-write strategy where necessary.

For workout history, completed sessions should generally be treated as durable historical records rather than frequently mutated objects.

Do not silently destroy local unsynchronized workout data.

---

# 35. Zustand

Use Zustand for appropriate application state such as:

```text
auth/session state
active workout state
onboarding state
small UI state
sync state
```

Do not turn Zustand into the database.

Persistent workout records belong in SQLite/Supabase.

---

# 36. Suggested Route Structure

Adapt to the existing repository rather than blindly replacing it.

A reasonable Expo Router structure is:

```text
app/
│
├── _layout.tsx
│
├── index.tsx
│
├── login.tsx
│
├── onboarding/
│   ├── _layout.tsx
│   ├── days.tsx
│   ├── body-parts.tsx
│   └── exercises.tsx
│
├── (tabs)/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── history.tsx
│   └── profile.tsx
│
├── workout/
│   ├── [sessionId].tsx
│   ├── exercise/
│   │   └── [sessionExerciseId].tsx
│   └── summary/
│       └── [sessionId].tsx
│
├── history/
│   ├── [sessionId].tsx
│   └── exercise/
│       └── [sessionExerciseId].tsx
│
└── plan/
    └── edit.tsx
```

Change this if the existing project architecture provides a cleaner integration.

---

# 37. Suggested Internal Structure

```text
src/
├── components/
├── features/
│   ├── auth/
│   ├── onboarding/
│   ├── workout/
│   ├── history/
│   ├── profile/
│   └── sync/
│
├── db/
│   ├── sqlite/
│   ├── repositories/
│   └── migrations/
│
├── lib/
│   ├── supabase/
│   └── network/
│
├── stores/
├── hooks/
├── types/
├── constants/
└── utils/
```

Prefer feature-oriented organization where appropriate.

---

# 38. Repository Pattern

Keep UI components independent from raw database details where practical.

Example:

```text
UI
 ↓
Workout Repository
 ↓
SQLite
 ↓
Sync Service
 ↓
Supabase
```

The workout screen should not contain large amounts of raw SQL/Supabase synchronization logic.

---

# 39. Empty States

Handle at minimum:

**No workout today**

```text
Rest Day
Your next workout is tomorrow.
```

**No previous performance**

```text
First time performing Bench Press.
```

**No history**

```text
No workouts yet.
Complete your first workout to see it here.
```

**Offline**

Do not show a scary error if local functionality works.

Use something subtle such as:

```text
Offline
Changes will sync when you're connected.
```

---

# 40. Loading and Error States

Avoid blank screens.

Provide sensible:

* loading indicators;
* empty states;
* retry actions;
* authentication failure handling;
* Supabase failure handling;
* SQLite failure handling.

Workout entry must prioritize preserving user-entered information.

---

# 41. UI Direction

The supplied designs are references, not pixel-perfect requirements.

Codex has freedom to improve them.

General visual direction:

```text
Background
near-black / charcoal

Cards
slightly lighter charcoal

Primary accent
orange

Primary text
white

Secondary text
gray

Success
green
```

Design characteristics:

* modern;
* strong;
* clean;
* fitness oriented;
* minimal;
* high contrast;
* consistent rounded cards;
* good spacing;
* accessible touch targets.

Do not make the interface excessively decorative.

---

# 42. MVP Non-Goals

Do NOT spend implementation time on:

```text
Push notifications
Workout reminders
Social features
Friends
Leaderboards
AI workout generation
Diet tracking
Calories tracking
Advanced analytics
Personal-record algorithms
Wearables
Apple Health
Google Fit
Video exercise tutorials
Trainer marketplace
Subscriptions
Payments
kg/lb switching
Complex testing infrastructure
```

These are outside the current MVP.

---

# 43. Critical Product Rules

These rules must not be violated.

**Rule 1**

Previous workout numbers are reference values.

Never automatically record them as today's performance.

**Rule 2**

Historical workouts must survive workout-plan changes.

**Rule 3**

Every exercise set is an individual database record.

**Rule 4**

Workout logging must work without internet.

**Rule 5**

A workout is completed only when the user explicitly presses Finish Workout.

**Rule 6**

“Previous performance” means the most recent completed occurrence of that exercise, not necessarily last calendar week.

**Rule 7**

Do not require sets/reps/weight during onboarding.

**Rule 8**

One workout day can contain multiple body parts.

**Rule 9**

Only kilograms are required for MVP.

**Rule 10**

Do not lose unsynchronized local workout data because of network failure.

---

# 44. Example Complete User Journey

```text
Amit installs app
        ↓
Continue with Google
        ↓
Google authentication succeeds
        ↓
First-time user detected
        ↓
Select workout days

Mon Tue Wed Thu Fri
        ↓
Assign body parts

Mon → Chest + Triceps
Tue → Back + Biceps
Wed → Legs
Thu → Shoulders + Triceps
Fri → Chest + Back
        ↓
Select exercises
        ↓
Save plan locally + synchronize
        ↓
HOME
        ↓
Monday detected
        ↓
Chest + Triceps displayed
        ↓
START WORKOUT
        ↓
Bench Press
        ↓
No previous performance
        ↓
Enter:

60 × 10
60 × 8
55 × 10
50 × 12
        ↓
Complete Exercise
        ↓
Complete remaining exercises
        ↓
FINISH WORKOUT
        ↓
Session saved
        ↓
Supabase synchronized
```

Next time:

```text
Monday
   ↓
Chest + Triceps
   ↓
Start Workout
   ↓
Bench Press
   ↓
Query most recent completed
Bench Press performance
   ↓

LAST TIME                 TODAY

60 × 10                  [   ] [   ]
60 × 8                   [   ] [   ]
55 × 10                  [   ] [   ]
50 × 12                  [   ] [   ]

   ↓

User attempts to improve
   ↓
62.5 × 10
60   × 10
55   × 12
50   × 12

   ↓

Save new history
```

This loop is the product.

---

# 45. Implementation Priority

Implement in this order:

```text
Existing-project inspection
        ↓
Supabase configuration/schema
        ↓
SQLite local database
        ↓
Authentication
        ↓
Exercise seed data
        ↓
Onboarding
        ↓
Home
        ↓
Today's workout resolution
        ↓
Start workout
        ↓
Exercise/set logging
        ↓
Previous-performance retrieval
        ↓
Finish workout
        ↓
Workout history
        ↓
Previous-vs-current comparison
        ↓
Profile
        ↓
Edit workout plan
        ↓
Offline synchronization
        ↓
UI polish
```

However, design the persistence layer for offline-first behavior from the beginning. Do not bolt SQLite onto an online-only architecture at the end.

---

# 46. Instructions to Codex

Treat this PRD as the source of truth for product behavior.

Before writing code:

1. Inspect the existing repository completely enough to understand its architecture.
2. Identify installed dependencies and existing authentication/Supabase configuration.
3. Reuse working infrastructure.
4. Do not recreate working project setup.
5. Do not unnecessarily change package versions.
6. Do not replace existing configuration unless required.
7. Understand existing environment-variable conventions.
8. Preserve working Google/Supabase setup if already implemented.

Then implement the MVP **end-to-end**.

When implementation details are unspecified, choose the simplest production-sensible solution consistent with this PRD.

Do not stop after generating scaffolding.

Do not only generate mock UI.

Implement actual:

* persistence;
* queries;
* navigation;
* authentication;
* onboarding;
* workout creation;
* set logging;
* previous-performance lookup;
* history;
* profile;
* plan editing;
* offline storage;
* synchronization.

If Supabase dashboard configuration, Google OAuth credentials, secrets, or another action cannot safely be performed from the repository, create the necessary code/config/migration and clearly document the exact manual action required instead of fabricating credentials.

Prioritize a **working MVP over additional features**.

---

# 47. Definition of Done

The MVP is complete when this scenario works:

> A new user signs in with Google, creates a weekly workout plan, selects exercises, starts today's workout, records exercises with arbitrary sets/reps/weights while offline, finishes the workout, later reconnects and synchronizes the data to Supabase, returns on another workout day, sees their most recent performance for each repeated exercise, records a new performance, and can inspect both workouts through Previous Data.

Additionally:

* restarting the application during an active locally saved workout does not destroy it;
* another authenticated user cannot read the first user's private workout data;
* editing the current workout plan does not rewrite historical sessions;
* failed synchronization does not delete local workout data;
* first-time exercises work without previous-performance data;
* rest days display correctly;
* Google logout works;
* the three-tab navigation works;
* no non-MVP feature is required for the primary flow.

That is the target Codex should execute against.
