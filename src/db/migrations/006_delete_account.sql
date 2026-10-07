-- Apply in the Supabase SQL Editor as postgres before shipping account deletion.
begin;

create function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
begin
  if account_id is null then
    raise exception 'Sign in to delete your account' using errcode = '28000';
  end if;

  -- Delete children first, including references to custom exercises. Every
  -- statement is part of the same transaction: failures leave the account intact.
  delete from public.exercise_sets where user_id = account_id;
  delete from public.session_exercises where user_id = account_id;
  delete from public.workout_sessions where user_id = account_id;
  delete from public.workout_day_exercises where user_id = account_id;
  delete from public.workout_day_body_parts where user_id = account_id;
  delete from public.workout_days where user_id = account_id;
  delete from public.workout_plans where user_id = account_id;
  delete from public.exercises where created_by = account_id;
  -- Cascades remove the profile and notification deliveries, as well as Auth
  -- identities and sessions. No client-supplied user ID or admin key is accepted.
  delete from auth.users where id = account_id;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

commit;
