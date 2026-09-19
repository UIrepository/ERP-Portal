-- The single answer to "has this person paid for this?".
--
-- The resolve-content edge function is the only caller. It passes an email that
-- it has already proved belongs to the requester (verified against the main
-- website's Supabase Auth), never an email supplied by the browser.
--
-- The logic deliberately mirrors the RLS already on recordings/notes/dpp_content
-- so the website and the portal can never disagree about who owns what:
--   direct  — a user_enrollments row for this exact batch + subject
--   merged  — an active subject_merges pairing to something they do own

create or replace function public.has_content_entitlement(
  p_email   text,
  p_batch   text,
  p_subject text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
        from public.user_enrollments ue
       where lower(ue.email)   = lower(p_email)
         and ue.batch_name     = p_batch
         and ue.subject_name   = p_subject
    )
    or exists (
      select 1
        from public.subject_merges sm
        join public.user_enrollments ue
          on lower(ue.email) = lower(p_email)
       where sm.is_active
         and (
              (sm.primary_batch     = p_batch
           and sm.primary_subject   = p_subject
           and sm.secondary_batch   = ue.batch_name
           and sm.secondary_subject = ue.subject_name)
            or
              (sm.secondary_batch   = p_batch
           and sm.secondary_subject = p_subject
           and sm.primary_batch     = ue.batch_name
           and sm.primary_subject   = ue.subject_name)
         )
    );
$$;

comment on function public.has_content_entitlement(text, text, text) is
  'True when the email owns (batch, subject) directly or through an active subject merge. Service role only — it takes an email as an argument, so it must never be reachable from a browser.';

-- Lock it to the service role. anon/authenticated must not be able to probe
-- other people''s entitlements by guessing emails.
revoke all on function public.has_content_entitlement(text, text, text) from public, anon, authenticated;
grant execute on function public.has_content_entitlement(text, text, text) to service_role;
