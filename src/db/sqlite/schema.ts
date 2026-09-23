// Local SQLite schema. Cloud PostgreSQL SQL remains in ../migrations/.
export const SCHEMA_VERSION = 1;
export const INITIAL_SCHEMA = `
create table users (
  id text primary key not null,
  auth_user_id text not null unique,
  name text not null default '',
  email text,
  avatar_url text,
  onboarding_done integer not null default false,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  constraint user_identity_matches check (id = auth_user_id)
);

-- User-owned children repeat user_id so composite foreign keys enforce ownership
-- across relationships, independently of application code and RLS filtering.
create table workout_plans (
  id text primary key not null,
  user_id text not null references users(id) on delete restrict,
  name text not null default 'My Workout Plan',
  is_active integer not null default true,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at text,
  unique (id, user_id)
);
create unique index one_active_plan_per_user on workout_plans(user_id)
  where is_active and deleted_at is null;

create table workout_days (
  id text primary key not null,
  user_id text not null references users(id) on delete restrict,
  plan_id text not null,
  day_of_week integer not null check (day_of_week between 1 and 7), -- ISO: Monday=1
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at text,
  unique (id, user_id),
  foreign key (plan_id, user_id) references workout_plans(id, user_id)
);
create unique index one_live_weekday_per_plan on workout_days(plan_id, day_of_week)
  where deleted_at is null;

create table workout_day_body_parts (
  id text primary key not null,
  user_id text not null references users(id) on delete restrict,
  workout_day_id text not null,
  body_part text not null check (length(trim(body_part)) > 0),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at text,
  foreign key (workout_day_id, user_id) references workout_days(id, user_id)
);
create unique index one_live_body_part_per_day
  on workout_day_body_parts(workout_day_id, body_part) where deleted_at is null;

create table exercises (
  id text primary key not null,
  name text not null check (length(trim(name)) > 0),
  muscle_group text not null check (length(trim(muscle_group)) > 0),
  image_url text,
  tracking_type text not null default 'reps' check (tracking_type in ('reps', 'duration')),
  default_weight_type text not null default 'weighted'
    check (default_weight_type in ('weighted', 'bodyweight')),
  is_custom integer not null default false,
  created_by text references users(id),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at text,
  -- Custom exercise creation is outside this MVP. Only the shared library is exposed.
  constraint shared_library_only check (not is_custom and created_by is null)
);
create unique index exercise_library_name on exercises(lower(name), muscle_group);

create table workout_day_exercises (
  id text primary key not null,
  user_id text not null references users(id) on delete restrict,
  workout_day_id text not null,
  exercise_id text not null references exercises(id),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at text,
  foreign key (workout_day_id, user_id) references workout_days(id, user_id)
);
create unique index one_live_exercise_per_day
  on workout_day_exercises(workout_day_id, exercise_id) where deleted_at is null;

create table workout_sessions (
  id text primary key not null,
  user_id text not null references users(id) on delete restrict,
  workout_day_id text,
  workout_date text not null, -- Device-local start date, retained across midnight/timezone changes.
  title text not null check (length(trim(title)) > 0),
  body_parts text not null default '[]' check (json_valid(body_parts) and json_type(body_parts) = 'array'), -- Historical snapshot, never derive from current plan.
  started_at text not null,
  completed_at text,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (id, user_id),
  foreign key (workout_day_id, user_id) references workout_days(id, user_id),
  check ((status = 'active' and completed_at is null)
      or (status = 'completed' and completed_at is not null and completed_at >= started_at))
);
-- Offline sessions created independently on different devices must still upload.
-- Resume/one-active-workout behavior is enforced locally; no uniqueness constraint
-- here may discard a second device's offline workout.
create index session_history on workout_sessions(user_id, started_at desc, id);

create table session_exercises (
  id text primary key not null,
  user_id text not null references users(id) on delete restrict,
  session_id text not null,
  exercise_id text not null references exercises(id),
  exercise_name text not null check (length(trim(exercise_name)) > 0),
  muscle_group text not null,
  tracking_type text not null check (tracking_type in ('reps', 'duration')),
  sort_order integer not null default 0 check (sort_order >= 0),
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at text,
  unique (id, user_id, tracking_type),
  foreign key (session_id, user_id) references workout_sessions(id, user_id)
);
create unique index one_live_exercise_per_session
  on session_exercises(session_id, exercise_id) where deleted_at is null;
create index previous_exercise_lookup on session_exercises(user_id, exercise_id, session_id)
  where status = 'completed' and deleted_at is null;

create table exercise_sets (
  id text primary key not null,
  user_id text not null references users(id) on delete restrict,
  session_exercise_id text not null,
  set_number integer not null check (set_number > 0),
  tracking_type text not null check (tracking_type in ('reps', 'duration')),
  weight_type text not null default 'weighted' check (weight_type in ('weighted', 'bodyweight')),
  weight_kg real check (weight_kg >= 0),
  reps integer check (reps > 0),
  duration_seconds integer check (duration_seconds > 0),
  completed integer not null default false,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at text,
  foreign key (session_exercise_id, user_id, tracking_type)
    references session_exercises(id, user_id, tracking_type),
  check (weight_type <> 'bodyweight' or weight_kg is null),
  check ((tracking_type = 'reps' and duration_seconds is null)
      or (tracking_type = 'duration' and reps is null)),
  -- Partial/blank rows can be saved, including in a finished workout.
  -- They must not claim to be completed sets.
  check (not completed or (
    (weight_type = 'bodyweight' or weight_kg is not null)
    and ((tracking_type = 'reps' and reps is not null)
      or (tracking_type = 'duration' and duration_seconds is not null))))
);
create unique index one_live_set_number on exercise_sets(session_exercise_id, set_number)
  where deleted_at is null;


-- A database file belongs to one account, including pending offline changes.
create table local_account (user_id text primary key not null);
create table pending_changes (
  sequence integer primary key autoincrement,
  table_name text not null check (table_name in ('users', 'workout_plans',
    'workout_days', 'workout_day_body_parts', 'workout_day_exercises',
    'workout_sessions', 'session_exercises', 'exercise_sets')),
  record_id text not null,
  revision integer not null default 1,
  unique (table_name, record_id)
);
create trigger users_account_insert before insert on users
when not exists (select 1 from local_account where user_id = new.id)
begin select raise(abort, 'Account mismatch'); end;
create trigger users_account_update before update on users
when not exists (select 1 from local_account where user_id = new.id)
begin select raise(abort, 'Account mismatch'); end;
create trigger workout_plans_account_insert before insert on workout_plans
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger workout_plans_account_update before update on workout_plans
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger workout_days_account_insert before insert on workout_days
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger workout_days_account_update before update on workout_days
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger workout_day_body_parts_account_insert before insert on workout_day_body_parts
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger workout_day_body_parts_account_update before update on workout_day_body_parts
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger workout_day_exercises_account_insert before insert on workout_day_exercises
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger workout_day_exercises_account_update before update on workout_day_exercises
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger workout_sessions_account_insert before insert on workout_sessions
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger workout_sessions_account_update before update on workout_sessions
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger session_exercises_account_insert before insert on session_exercises
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger session_exercises_account_update before update on session_exercises
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger exercise_sets_account_insert before insert on exercise_sets
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
create trigger exercise_sets_account_update before update on exercise_sets
when not exists (select 1 from local_account where user_id = new.user_id)
begin select raise(abort, 'Account mismatch'); end;
`;
