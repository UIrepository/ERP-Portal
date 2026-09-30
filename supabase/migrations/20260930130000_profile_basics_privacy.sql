-- Close a privacy hole in profile_basics.
--
-- profile_basics is how the community screens show OTHER people's names and
-- avatars (profiles itself is RLS-locked to your own row). It is owned by
-- postgres and has no security_invoker, so it reads profiles with owner rights.
-- That is intended for name/avatar — but it also exposed:
--   * email — any logged-in user could list every user's email (1,833 rows);
--   * INSERT/UPDATE/DELETE — it is a simple, auto-updatable view, so any
--     logged-in user could rewrite another user's name/email/avatar through it.
--
-- The app only ever selects (name, avatar_url) from it. Recreate it without the
-- email column and make it read-only.

drop view if exists public.profile_basics;

create view public.profile_basics
  with (security_barrier = true)
as
select user_id, name, avatar_url
  from public.profiles;

comment on view public.profile_basics is
  'Public-safe profile fields (name, avatar) for showing other users. No email. Read-only.';

revoke all on public.profile_basics from public, anon, authenticated;
grant select on public.profile_basics to authenticated;
