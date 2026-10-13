-- Apply to existing Supabase databases, then reopen the exercise picker to
-- refresh its local catalog. Historical workouts and sets stay unchanged.
begin;

insert into public.exercises (name, muscle_group, tracking_type, default_weight_type)
values ('Russian Twist', 'Core', 'reps', 'weighted')
on conflict (lower(name), muscle_group) do update
set tracking_type = excluded.tracking_type,
    default_weight_type = excluded.default_weight_type,
    deleted_at = null;

update public.exercises
set default_weight_type = 'weighted'
where lower(name) = 'hanging leg raise' and muscle_group = 'Core';

commit;
