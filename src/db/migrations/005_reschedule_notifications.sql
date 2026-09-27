-- Allow a different scheduled time to send again on the same day.
-- Run after 004. Existing history and customized messages are preserved.
begin;

alter table public.notification_deliveries add column scheduled_at timestamptz;
-- Historical rows did not retain the scheduled time. Use their enqueue minute
-- as the best available approximation; new rows record the exact due instant.
update public.notification_deliveries
set scheduled_at = date_trunc('minute', created_at);
alter table public.notification_deliveries alter column scheduled_at set not null;
alter table public.notification_deliveries
  drop constraint notification_deliveries_user_id_local_date_key;
alter table public.notification_deliveries
  add constraint notification_deliveries_user_scheduled_at_key unique (user_id, scheduled_at);
create index notification_deliveries_user_recent
  on public.notification_deliveries(user_id, created_at desc, id desc);

create or replace function public.claim_notification_deliveries()
returns setof public.notification_deliveries
language plpgsql security definer set search_path = '' as $$
declare
  schedule public.notification_schedule;
  today date;
  due_at timestamptz;
begin
  -- Serialize enqueueing; the unique constraint is an guard for each scheduled instant.
  if not pg_try_advisory_xact_lock(90321001) then return; end if;
  select * into schedule from public.notification_schedule where id = true;
  if not found or not schedule.enabled then return; end if;
  today := (now() at time zone schedule.timezone)::date;
  due_at := (today + schedule.local_time) at time zone schedule.timezone;

  -- Catch up briefly after a cron delay, without sending old reminders.
  if now() >= due_at and now() < due_at + interval '15 minutes' then
    insert into public.notification_deliveries
      (user_id, local_date, scheduled_at, message_id, expo_push_token, title, body)
    select u.id, today, due_at, msg.id, u.expo_push_token,
      replace(msg.title, '{name}', coalesce(nullif(left(trim(u.name), 60), ''), 'Athlete')),
      replace(msg.body, '{name}', coalesce(nullif(left(trim(u.name), 60), ''), 'Athlete'))
    from public.users u
    left join lateral (
      select d.message_id from public.notification_deliveries d
      where d.user_id = u.id order by d.created_at desc, d.id desc limit 1
    ) previous on true
    cross join lateral (
      select m.* from public.notification_messages m where m.active
      order by case when m.id > coalesce(previous.message_id, 0) then 0 else 1 end, m.id
      limit 1
    ) msg
    where u.expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$'
    on conflict (user_id, scheduled_at) do nothing;
  end if;

  -- A worker may have died after Expo accepted a request. Do not blindly resend.
  update public.notification_deliveries set status = 'unknown',
    error_code = 'WorkerInterrupted', updated_at = now()
  where status = 'sending' and updated_at < now() - interval '5 minutes';
  update public.notification_deliveries set status = 'failed',
    error_code = 'ReminderExpired', updated_at = now()
  where status = 'pending' and created_at < now() - interval '30 minutes';

  return query
    with due as (
      select d.id from public.notification_deliveries d
      where d.status = 'pending' and d.next_attempt_at <= now()
      order by d.next_attempt_at, d.id limit 100 for update skip locked
    )
    update public.notification_deliveries d set status = 'sending',
      attempts = d.attempts + 1, updated_at = now()
    from due where d.id = due.id returning d.*;
end;
$$;
commit;
