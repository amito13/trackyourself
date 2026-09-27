-- Run after 003_expo_push_token.sql in the Supabase SQL Editor.
begin;

create table public.notification_schedule (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  local_time time not null default '21:00',
  timezone text not null default 'Asia/Kolkata'
);
insert into public.notification_schedule default values;

create table public.notification_messages (
  id bigint generated always as identity primary key,
  title text not null check (length(title) between 1 and 100),
  body text not null check (length(body) between 1 and 500),
  active boolean not null default true
);
INSERT INTO public.notification_messages(title, body) VALUES
  ('{name}, aaj gym gaye? 👀',
   'Ya phir kal se pakka wala plan chal raha hai? 😭'),

  ('{name}, aaj exercise kiya? 🏋️',
   'OutDo sab dekh raha hai... bas workout nahi dikh raha 👀'),

  ('Gym kyu nahi gaye bhai? 😭',
   '{name}, membership ke paise vasool bhi karne hain 💀'),

  ('{name}, post-workout liya? 👀',
   'Workout log karna bhi baaki hai. Pehle woh kar lo 😌'),

  ('Aaj rest day tha kya? 🤨',
   'Ya rest day khud hi declare kar diya, {name}? 😭'),

  ('{name}, gym wale yaad kar rahe hain 🥺',
   'Ek workout maar ke aa jao. OutDo pe attendance bhi laga dena.'),

  ('Protein baad mein 💀',
   '{name}, pehle workout toh complete karo 😭'),

  ('Aaj ka PR? 👀',
   'Ya aaj bhi sirf reels mein fitness motivation dekha? 📱'),

  ('{name}, ek set aur? 😏',
   'Last time se thoda better. Bas wahi toh game hai 📈'),

  ('Chest day skip? Illegal. 🚨',
   '{name}, OutDo mein aaj ka workout abhi tak missing hai.'),

  ('Kal kitna uthaya tha? 🤔',
   'Guess mat karo, {name}. OutDo kholo aur beat karo 📈'),

  ('{name}, progress kaha hai? 👀',
   'Workout kiya hai toh log bhi kar do. Future you thank karega.'),

  ('Bas 1 workout bro 😭',
   '{name}, motivation ka wait mat karo. Gym jao, baaki baad mein.'),

  ('Aaj muscles ko kaam milega? 🥲',
   '{name}, ya unki bhi chhutti approve kar di?'),

  ('Your dumbbells miss you 🥺',
   '{name}, unhe zyada wait mat karao. Aaj ka workout start karo.');



create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  local_date date not null,
  message_id bigint not null references public.notification_messages(id),
  expo_push_token text not null,
  title text not null,
  body text not null,
  status text not null default 'pending' check (status in
    ('pending', 'sending', 'accepted', 'delivered', 'failed', 'unknown')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  ticket_id text,
  next_receipt_at timestamptz not null default now(),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);
create index notification_pending on public.notification_deliveries(next_attempt_at)
  where status = 'pending';
create index notification_receipts on public.notification_deliveries(next_receipt_at)
  where status = 'accepted';

-- Templates, schedule and delivery tokens are backend-only.
alter table public.notification_schedule enable row level security;
alter table public.notification_messages enable row level security;
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_schedule, public.notification_messages,
  public.notification_deliveries from anon, authenticated;
grant all on public.notification_schedule, public.notification_messages,
  public.notification_deliveries to service_role;
grant usage, select on sequence public.notification_messages_id_seq to service_role;

create function public.claim_notification_deliveries()
returns setof public.notification_deliveries
language plpgsql security definer set search_path = '' as $$
declare
  schedule public.notification_schedule;
  today date;
  due_at timestamptz;
begin
  -- Serialize enqueueing; the unique constraint is an additional daily guard.
  if not pg_try_advisory_xact_lock(90321001) then return; end if;
  select * into schedule from public.notification_schedule where id = true;
  if not found or not schedule.enabled then return; end if;
  today := (now() at time zone schedule.timezone)::date;
  due_at := (today + schedule.local_time) at time zone schedule.timezone;

  -- Catch up briefly after a cron delay, without sending old reminders.
  if now() >= due_at and now() < due_at + interval '15 minutes' then
    insert into public.notification_deliveries
      (user_id, local_date, message_id, expo_push_token, title, body)
    select u.id, today, msg.id, u.expo_push_token,
      replace(msg.title, '{name}', coalesce(nullif(left(trim(u.name), 60), ''), 'Athlete')),
      replace(msg.body, '{name}', coalesce(nullif(left(trim(u.name), 60), ''), 'Athlete'))
    from public.users u
    left join lateral (
      select d.message_id from public.notification_deliveries d
      where d.user_id = u.id order by d.local_date desc limit 1
    ) previous on true
    cross join lateral (
      select m.* from public.notification_messages m where m.active
      order by case when m.id > coalesce(previous.message_id, 0) then 0 else 1 end, m.id
      limit 1
    ) msg
    where u.expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$'
    on conflict (user_id, local_date) do nothing;
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
revoke all on function public.claim_notification_deliveries() from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries() to service_role;

commit;
