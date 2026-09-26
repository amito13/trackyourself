-- Track Yourself: initial Supabase PostgreSQL schema.
-- Run once in Supabase SQL Editor against a project without these application tables.
-- Transactional: a failure rolls back this migration. Do not use on an existing
-- application schema without reviewing its differences first.
begin;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '',
  email text,
  avatar_url text,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_identity_matches check (id = auth_user_id)
);

-- User-owned children repeat user_id so composite foreign keys enforce ownership
-- across relationships, independently of application code and RLS filtering.
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null default 'My Workout Plan',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);
create unique index one_active_plan_per_user on public.workout_plans(user_id)
  where is_active and deleted_at is null;

create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id uuid not null,
  day_of_week integer not null check (day_of_week between 1 and 7), -- ISO: Monday=1
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (plan_id, user_id) references public.workout_plans(id, user_id)
);
create unique index one_live_weekday_per_plan on public.workout_days(plan_id, day_of_week)
  where deleted_at is null;

create table public.workout_day_body_parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workout_day_id uuid not null,
  body_part text not null check (length(trim(body_part)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (workout_day_id, user_id) references public.workout_days(id, user_id)
);
create unique index one_live_body_part_per_day
  on public.workout_day_body_parts(workout_day_id, body_part) where deleted_at is null;

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  muscle_group text not null check (length(trim(muscle_group)) > 0),
  image_url text,
  tracking_type text not null default 'reps' check (tracking_type in ('reps', 'duration')),
  default_weight_type text not null default 'weighted'
    check (default_weight_type in ('weighted', 'bodyweight')),
  is_custom boolean not null default false,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Custom exercise creation is outside this MVP. Only the shared library is exposed.
  constraint shared_library_only check (not is_custom and created_by is null)
);
create unique index exercise_library_name on public.exercises(lower(name), muscle_group);

create table public.workout_day_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workout_day_id uuid not null,
  exercise_id uuid not null references public.exercises(id),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (workout_day_id, user_id) references public.workout_days(id, user_id)
);
create unique index one_live_exercise_per_day
  on public.workout_day_exercises(workout_day_id, exercise_id) where deleted_at is null;

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workout_day_id uuid,
  workout_date date not null, -- Device-local start date, retained across midnight/timezone changes.
  title text not null check (length(trim(title)) > 0),
  body_parts text[] not null default '{}', -- Historical snapshot, never derive from current plan.
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (workout_day_id, user_id) references public.workout_days(id, user_id),
  check ((status = 'active' and completed_at is null)
      or (status = 'completed' and completed_at is not null and completed_at >= started_at))
);
-- Offline sessions created independently on different devices must still upload.
-- Resume/one-active-workout behavior is enforced locally; no uniqueness constraint
-- here may discard a second device's offline workout.
create index session_history on public.workout_sessions(user_id, started_at desc, id);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null,
  exercise_id uuid not null references public.exercises(id),
  exercise_name text not null check (length(trim(exercise_name)) > 0),
  muscle_group text not null,
  tracking_type text not null check (tracking_type in ('reps', 'duration')),
  sort_order integer not null default 0 check (sort_order >= 0),
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id, tracking_type),
  foreign key (session_id, user_id) references public.workout_sessions(id, user_id)
);
create unique index one_live_exercise_per_session
  on public.session_exercises(session_id, exercise_id) where deleted_at is null;
create index previous_exercise_lookup on public.session_exercises(user_id, exercise_id, session_id)
  where status = 'completed' and deleted_at is null;

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_exercise_id uuid not null,
  set_number integer not null check (set_number > 0),
  tracking_type text not null check (tracking_type in ('reps', 'duration')),
  weight_type text not null default 'weighted' check (weight_type in ('weighted', 'bodyweight')),
  weight_kg numeric(10,3) check (weight_kg >= 0),
  reps integer check (reps > 0),
  duration_seconds integer check (duration_seconds > 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (session_exercise_id, user_id, tracking_type)
    references public.session_exercises(id, user_id, tracking_type),
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
create unique index one_live_set_number on public.exercise_sets(session_exercise_id, set_number)
  where deleted_at is null;

-- Private trigger functions are not exposed as public RPCs.
create schema if not exists tracker_private;
revoke all on schema tracker_private from public, anon, authenticated;

create function tracker_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create function tracker_private.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users(id, auth_user_id, name, email, avatar_url)
  values (new.id, new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.email, coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger tracker_auth_user_created after insert on auth.users
for each row execute function tracker_private.create_profile();

-- Include accounts that signed in before this migration was installed.
insert into public.users(id, auth_user_id, name, email, avatar_url)
select id, id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', ''),
  email, coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture')
from auth.users on conflict (id) do nothing;

create function tracker_private.guard_session()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'active' then
      raise exception 'Upload an active session, then its exercises/sets, then mark it completed';
    end if;
  else
    if old.status = 'completed' then
      raise exception 'Completed workouts are read-only';
    end if;
    if new.id <> old.id or new.user_id <> old.user_id then
      raise exception 'Session identity cannot change';
    end if;
  end if;
  return new;
end;
$$;
create trigger a_guard_session before insert or update on public.workout_sessions
for each row execute function tracker_private.guard_session();

create function tracker_private.guard_session_child()
returns trigger language plpgsql set search_path = '' as $$
declare
  parent_id uuid;
  parent_status text;
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.user_id <> old.user_id then
      raise exception 'Record identity cannot change';
    end if;
    if tg_table_name = 'session_exercises' then
      if new.session_id <> old.session_id then raise exception 'Session cannot change'; end if;
    else
      if new.session_exercise_id <> old.session_exercise_id then
        raise exception 'Parent exercise cannot change';
      end if;
    end if;
  end if;
  if tg_table_name = 'session_exercises' then
    parent_id := new.session_id;
  else
    select session_id into parent_id from public.session_exercises
      where id = new.session_exercise_id and user_id = new.user_id and deleted_at is null;
  end if;
  -- Serialize child writes against finishing the session.
  select status into parent_status from public.workout_sessions
    where id = parent_id and user_id = new.user_id for update;
  if parent_status is distinct from 'active' then
    raise exception 'An active owned workout is required; completed workouts are read-only';
  end if;
  return new;
end;
$$;
create trigger a_guard_session_exercise before insert or update on public.session_exercises
for each row execute function tracker_private.guard_session_child();
create trigger a_guard_exercise_set before insert or update on public.exercise_sets
for each row execute function tracker_private.guard_session_child();

alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
create trigger z_touch_updated_at before update on public.users
for each row execute function tracker_private.touch_updated_at();
alter table public.exercises enable row level security;
revoke all on public.exercises from anon, authenticated;
create trigger z_touch_updated_at before update on public.exercises
for each row execute function tracker_private.touch_updated_at();
alter table public.workout_plans enable row level security;
revoke all on public.workout_plans from anon, authenticated;
create trigger z_touch_updated_at before update on public.workout_plans
for each row execute function tracker_private.touch_updated_at();
alter table public.workout_days enable row level security;
revoke all on public.workout_days from anon, authenticated;
create trigger z_touch_updated_at before update on public.workout_days
for each row execute function tracker_private.touch_updated_at();
alter table public.workout_day_body_parts enable row level security;
revoke all on public.workout_day_body_parts from anon, authenticated;
create trigger z_touch_updated_at before update on public.workout_day_body_parts
for each row execute function tracker_private.touch_updated_at();
alter table public.workout_day_exercises enable row level security;
revoke all on public.workout_day_exercises from anon, authenticated;
create trigger z_touch_updated_at before update on public.workout_day_exercises
for each row execute function tracker_private.touch_updated_at();
alter table public.workout_sessions enable row level security;
revoke all on public.workout_sessions from anon, authenticated;
create trigger z_touch_updated_at before update on public.workout_sessions
for each row execute function tracker_private.touch_updated_at();
alter table public.session_exercises enable row level security;
revoke all on public.session_exercises from anon, authenticated;
create trigger z_touch_updated_at before update on public.session_exercises
for each row execute function tracker_private.touch_updated_at();
alter table public.exercise_sets enable row level security;
revoke all on public.exercise_sets from anon, authenticated;
create trigger z_touch_updated_at before update on public.exercise_sets
for each row execute function tracker_private.touch_updated_at();
grant select, insert, update on public.workout_plans to authenticated;
create policy own_select on public.workout_plans for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_insert on public.workout_plans for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_update on public.workout_plans for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index workout_plans_sync on public.workout_plans(user_id, updated_at, id);

grant select, insert, update on public.workout_days to authenticated;
create policy own_select on public.workout_days for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_insert on public.workout_days for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_update on public.workout_days for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index workout_days_sync on public.workout_days(user_id, updated_at, id);

grant select, insert, update on public.workout_day_body_parts to authenticated;
create policy own_select on public.workout_day_body_parts for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_insert on public.workout_day_body_parts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_update on public.workout_day_body_parts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index workout_day_body_parts_sync on public.workout_day_body_parts(user_id, updated_at, id);

grant select, insert, update on public.workout_day_exercises to authenticated;
create policy own_select on public.workout_day_exercises for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_insert on public.workout_day_exercises for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_update on public.workout_day_exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index workout_day_exercises_sync on public.workout_day_exercises(user_id, updated_at, id);

grant select, insert, update on public.workout_sessions to authenticated;
create policy own_select on public.workout_sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_insert on public.workout_sessions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_update on public.workout_sessions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index workout_sessions_sync on public.workout_sessions(user_id, updated_at, id);

grant select, insert, update on public.session_exercises to authenticated;
create policy own_select on public.session_exercises for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_insert on public.session_exercises for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_update on public.session_exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index session_exercises_sync on public.session_exercises(user_id, updated_at, id);

grant select, insert, update on public.exercise_sets to authenticated;
create policy own_select on public.exercise_sets for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_insert on public.exercise_sets for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy own_update on public.exercise_sets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index exercise_sets_sync on public.exercise_sets(user_id, updated_at, id);

-- No client hard-delete privileges: tombstones must remain downloadable by other devices.
grant select on public.users to authenticated;
grant update (name, avatar_url, onboarding_done) on public.users to authenticated;
create policy own_profile_select on public.users for select to authenticated
  using (id = (select auth.uid()));
create policy own_profile_update on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select on public.exercises to authenticated;
create policy read_library on public.exercises for select to authenticated using (true);
create index exercises_sync on public.exercises(updated_at, id);
revoke all on all functions in schema tracker_private from public, anon, authenticated;

-- Starter library. Generated UUIDs become stable library identifiers in this project.
insert into public.exercises(name, muscle_group, tracking_type, default_weight_type) values
  ('Bench Press', 'Chest', 'reps', 'weighted'),
  ('Incline Bench Press', 'Chest', 'reps', 'weighted'),
  ('Incline Dumbbell Press', 'Chest', 'reps', 'weighted'),
  ('Decline Bench Press', 'Chest', 'reps', 'weighted'),
  ('Dumbbell Press', 'Chest', 'reps', 'weighted'),
  ('Cable Fly', 'Chest', 'reps', 'weighted'),
  ('Pec Deck', 'Chest', 'reps', 'weighted'),
  ('Push Up', 'Chest', 'reps', 'bodyweight'),
  ('Chest Dips', 'Chest', 'reps', 'bodyweight'),
  ('Lat Pulldown', 'Back', 'reps', 'weighted'),
  ('Pull Up', 'Back', 'reps', 'bodyweight'),
  ('Barbell Row', 'Back', 'reps', 'weighted'),
  ('Dumbbell Row', 'Back', 'reps', 'weighted'),
  ('Seated Cable Row', 'Back', 'reps', 'weighted'),
  ('Deadlift', 'Back', 'reps', 'weighted'),
  ('Hyperextension', 'Back', 'reps', 'bodyweight'),
  ('Shrugs', 'Back', 'reps', 'weighted'),
  ('Straight Arms Pulldown', 'Back', 'reps', 'weighted'),
  ('Rear Delt Fly', 'Back', 'reps', 'weighted'),
  ('Overhead Press', 'Shoulders', 'reps', 'weighted'),
  ('Dumbbell Shoulder Press', 'Shoulders', 'reps', 'weighted'),
  ('Lateral Raise', 'Shoulders', 'reps', 'weighted'),
  ('Front Raise', 'Shoulders', 'reps', 'weighted'),
  ('Reverse Fly', 'Shoulders', 'reps', 'weighted'),
  ('Face Pull', 'Shoulders', 'reps', 'weighted'),
  ('Rear Delt Fly', 'Shoulders', 'reps', 'weighted'),
  ('Shrugs', 'Shoulders', 'reps', 'weighted'),
  ('Barbell Curl', 'Biceps', 'reps', 'weighted'),
  ('Dumbbell Curl', 'Biceps', 'reps', 'weighted'),
  ('Hammer Curl', 'Biceps', 'reps', 'weighted'),
  ('Preacher Curl', 'Biceps', 'reps', 'weighted'),
  ('Cable Curl', 'Biceps', 'reps', 'weighted'),
  ('Tricep Pushdown', 'Triceps', 'reps', 'weighted'),
  ('Skull Crushers', 'Triceps', 'reps', 'weighted'),
  ('Overhead Tricep Extension', 'Triceps', 'reps', 'weighted'),
  ('Close Grip Bench Press', 'Triceps', 'reps', 'weighted'),
  ('Bench Dips', 'Triceps', 'reps', 'bodyweight'),
  ('Barbell Squat', 'Legs', 'reps', 'weighted'),
  ('Leg Press', 'Legs', 'reps', 'weighted'),
  ('Leg Extension', 'Legs', 'reps', 'weighted'),
  ('Leg Curl', 'Legs', 'reps', 'weighted'),
  ('Romanian Deadlift', 'Legs', 'reps', 'weighted'),
  ('Calf Raise', 'Legs', 'reps', 'weighted'),
  ('Bodyweight Squat', 'Legs', 'reps', 'bodyweight'),
  ('Wall Sit', 'Legs', 'duration', 'bodyweight'),
  ('Crunch', 'Core', 'reps', 'bodyweight'),
  ('Bicycle Crunch', 'Core', 'reps', 'bodyweight'),
  ('Hanging Leg Raise', 'Core', 'reps', 'bodyweight'),
  ('Cable Crunch', 'Core', 'reps', 'weighted'),
  ('Plank', 'Core', 'duration', 'bodyweight'),
  ('Side Plank', 'Core', 'duration', 'bodyweight'),
  ('Hollow Hold', 'Core', 'duration', 'bodyweight');

commit;
