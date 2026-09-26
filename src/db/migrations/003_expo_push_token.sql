-- Run in the Supabase SQL Editor after 001_initial_schema.sql.
-- Existing own_profile_select/own_profile_update RLS policies enforce ownership.
begin;

alter table public.users add column expo_push_token text;
grant update (expo_push_token) on public.users to authenticated;

commit;
