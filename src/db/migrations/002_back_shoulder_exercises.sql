-- Run in Supabase SQL Editor for projects that already have the initial schema.
-- Preserve existing exercise UUIDs and allow this migration to be rerun safely.
begin;

insert into public.exercises(name, muscle_group, tracking_type, default_weight_type) values
  ('Hyperextension', 'Back', 'reps', 'bodyweight'),
  ('Shrugs', 'Back', 'reps', 'weighted'),
  ('Straight Arms Pulldown', 'Back', 'reps', 'weighted'),
  ('Rear Delt Fly', 'Back', 'reps', 'weighted'),
  ('Rear Delt Fly', 'Shoulders', 'reps', 'weighted'),
  ('Shrugs', 'Shoulders', 'reps', 'weighted')
on conflict (lower(name), muscle_group) do nothing;

commit;
