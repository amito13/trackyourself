import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Install @electric-sql/pglite in a temporary directory and pass its module path.
// This runs the real migration in an isolated PostgreSQL engine, not your live DB.
test('notification SQL: scheduling, rotation, personalization, claiming and permissions', {
  skip: !process.env.PGLITE_MODULE && 'Set PGLITE_MODULE to run isolated PostgreSQL validation',
}, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table public.users (id uuid primary key, name text, expo_push_token text);
      insert into public.users values
        ('00000000-0000-0000-0000-000000000001', 'Amit', 'ExpoPushToken[test1]'),
        ('00000000-0000-0000-0000-000000000002', '', 'ExponentPushToken[test2]'),
        ('00000000-0000-0000-0000-000000000003', 'No token', null);
    `);
    await db.exec(await readFile(new URL('../src/db/migrations/004_scheduled_notifications.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../src/db/migrations/005_reschedule_notifications.sql', import.meta.url), 'utf8'));
    await db.exec("update public.notification_messages set title = 'Check in', body = '{name}, log your progress.'");
    const claim = () => db.query('select * from public.claim_notification_deliveries()');
    const schedule = (await db.query('select * from public.notification_schedule')).rows[0];
    assert.equal(schedule.local_time, '21:00:00');
    assert.equal(schedule.timezone, 'Asia/Kolkata');
    assert.equal((await db.query("select ('2026-09-27'::date + '21:00'::time) at time zone 'Asia/Kolkata' = '2026-09-27T15:30:00Z'::timestamptz as matches")).rows[0].matches, true);

    // Set a controlled timezone/time whose due moment is ten minutes in the future.
    await db.exec("update public.notification_schedule set timezone = 'UTC', local_time = ((now() at time zone 'UTC') + interval '10 minutes')::time");
    assert.equal((await claim()).rows.length, 0);
    await db.exec("update public.notification_schedule set local_time = (now() at time zone 'UTC')::time");
    const first = (await claim()).rows;
    assert.equal(first.length, 2);
    assert.ok(first.some((d) => d.body.startsWith('Amit,')));
    assert.ok(first.some((d) => d.body.startsWith('Athlete,')));
    assert.ok(first.every((d) => d.status === 'sending' && d.attempts === 1));
    assert.equal((await claim()).rows.length, 0, 'Repeated invocation cannot claim the same daily reminder');

    await db.exec("update public.notification_deliveries set local_date = local_date - 1, scheduled_at = scheduled_at - interval '1 day', status = 'delivered'");
    const second = (await claim()).rows;
    assert.ok(second.every((d) => Number(d.message_id) === 2), 'Next day uses next message');
    await db.exec("update public.notification_deliveries set status = 'delivered'; delete from public.notification_deliveries where local_date < (now() at time zone 'UTC')::date; update public.notification_deliveries set local_date = local_date - 1, scheduled_at = scheduled_at - interval '1 day', message_id = (select max(id) from public.notification_messages)");
    const wrapped = (await claim()).rows;
    assert.ok(wrapped.every((d) => Number(d.message_id) === 1), 'Last template wraps to first');

    await db.exec("update public.notification_deliveries set updated_at = now() - interval '6 minutes' where status = 'sending'");
    assert.equal((await claim()).rows.length, 0);
    assert.equal((await db.query("select count(*)::int as count from public.notification_deliveries where status = 'unknown'")).rows[0].count, 2);
    const originalTime = (await db.query('select local_time from public.notification_schedule')).rows[0].local_time;
    await db.exec("update public.notification_schedule set local_time = local_time - interval '1 minute'");
    const rescheduled = (await claim()).rows;
    assert.equal(rescheduled.length, 2, 'New time allows another reminder on the same day');
    assert.ok(rescheduled.every((d) => Number(d.message_id) === 2), 'Same-day rescheduling advances the message');
    assert.equal((await claim()).rows.length, 0, 'Repeated cron calls cannot duplicate the new time');
    await db.query('update public.notification_schedule set local_time = $1::time', [originalTime]);
    assert.equal((await claim()).rows.length, 0, 'Returning to an already used time does not resend');
    await db.exec("update public.notification_schedule set enabled = false");
    assert.equal((await claim()).rows.length, 0);

    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      await assert.rejects(claim, /permission denied/);
      await assert.rejects(() => db.query('select * from public.notification_deliveries'), /permission denied/);
      await assert.rejects(() => db.query('select * from public.notification_messages'), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.equal((await claim()).rows.length, 0);
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
