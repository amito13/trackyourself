-- Run AFTER deploying send-reminders and adding these two Vault secrets:
-- notification_project_url = your https://PROJECT_REF.supabase.co URL
-- notification_cron_secret = the same random value as NOTIFICATION_CRON_SECRET
-- Add secrets in the Supabase Vault dashboard; do not commit their values.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'notification_project_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'notification_cron_secret') then
    raise exception 'Add notification_project_url and notification_cron_secret to Vault first';
  end if;
end;
$$;

-- Re-running this script replaces the named job rather than creating duplicates.
select cron.schedule('send-daily-reminders', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
      where name = 'notification_project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
        where name = 'notification_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
