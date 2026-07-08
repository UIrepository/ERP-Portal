-- Store each user's Google account photo so their avatar can show across the
-- community. A user's Google photo is only available in their own session, so
-- each user writes their own value on login (see useAuth). Applied via the
-- management API on 2026-06-30; this file is the record.

alter table public.profiles add column if not exists avatar_url text;

-- Expose it via the read-only profile_basics view the community reads names from.
create or replace view public.profile_basics as
  select user_id, name, email, avatar_url
  from public.profiles;
