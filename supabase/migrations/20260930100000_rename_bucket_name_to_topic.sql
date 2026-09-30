-- Rename content_buckets.name -> content_buckets.topic.
--
-- A bucket is a topic (Random Variables, Sampling and Estimation, Revision),
-- so the column says so. Column-only rename: the table keeps its name, and the
-- RPC parameter names (p_name) are unchanged so existing callers keep working.
--
-- What follows the rename automatically:
--   * content_buckets_unique_name (index on lower(trim(name)))  -> now on topic
--   * the length(trim(name)) > 0 check constraint               -> now on topic
--   * RLS policies (none reference the column)
--
-- What does NOT follow, and is redefined below: ensure_bucket(), whose body
-- names the column. ensure_bucket_group() only calls ensure_bucket(), so it
-- needs no change.
--
-- DEPLOY ORDER: apply this migration, redeploy the upload-whiteboard-pdf edge
-- function and ship the app build in the same window. Anything still selecting
-- "name" from content_buckets fails once the column is renamed.

alter table public.content_buckets rename column name to topic;

create or replace function public.ensure_bucket(
  p_batch   text,
  p_subject text,
  p_name    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_topic text := trim(coalesce(p_name, ''));
begin
  if v_topic = '' then
    raise exception 'A topic needs a name';
  end if;

  -- service_role is trusted server-side code (edge functions, admin tooling)
  -- and carries no end user, so it is allowed through. Every browser-originated
  -- call arrives as 'authenticated' and must pass one of the two real checks.
  if not (
       auth.role() = 'service_role'
    or public.is_admin()
    or public.teacher_can_modify_schedule(p_batch, p_subject)
  ) then
    raise exception 'Not allowed to manage topics for % / %', p_batch, p_subject;
  end if;

  select b.id into v_id
    from public.content_buckets b
   where b.batch = p_batch
     and b.subject = p_subject
     and lower(trim(b.topic)) = lower(v_topic);

  if v_id is not null then
    return v_id;
  end if;

  insert into public.content_buckets (batch, subject, topic, position, created_by)
  values (
    p_batch,
    p_subject,
    v_topic,
    coalesce((select max(b2.position) + 1
                from public.content_buckets b2
               where b2.batch = p_batch and b2.subject = p_subject), 0),
    auth.uid()
  )
  on conflict (batch, subject, lower(trim(topic))) do nothing
  returning id into v_id;

  -- Lost a race with a concurrent insert — read the winner back.
  if v_id is null then
    select b.id into v_id
      from public.content_buckets b
     where b.batch = p_batch
       and b.subject = p_subject
       and lower(trim(b.topic)) = lower(v_topic);
  end if;

  return v_id;
end;
$$;

comment on function public.ensure_bucket(text, text, text) is
  'Get-or-create a topic for one (batch, subject). Idempotent and race-safe.';

comment on column public.content_buckets.topic is
  'Topic name the teacher typed — Random Variables, Chapter 3, Revision. Items with bucket_id null are shown as "Unsorted".';
