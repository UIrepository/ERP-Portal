-- Getting or creating a bucket, safely and idempotently.
--
-- Two functions:
--   ensure_bucket()        one (batch, subject)
--   ensure_bucket_group()  the whole merge group at once
--
-- ensure_bucket_group is the one the Go Live dialog calls. Going live inserts a
-- recording row for EVERY merged pair, and buckets are per (batch, subject), so
-- a teacher picking "Week 5" once must end up with a Week 5 in each batch of
-- the group — each holding its own copy. Without this, merged batches would
-- silently lose their grouping.
--
-- SECURITY DEFINER because a teacher going live for a merged class often is not
-- assigned to the partner batch. Authorisation is therefore checked explicitly
-- inside, reusing teacher_can_modify_schedule(), which already understands
-- "assigned directly, or through an active merge".

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
  v_id   uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'A bucket needs a name';
  end if;

  -- service_role is trusted server-side code (edge functions, admin tooling)
  -- and carries no end user, so it is allowed through. Every browser-originated
  -- call arrives as 'authenticated' and must pass one of the two real checks.
  if not (
       auth.role() = 'service_role'
    or public.is_admin()
    or public.teacher_can_modify_schedule(p_batch, p_subject)
  ) then
    raise exception 'Not allowed to manage buckets for % / %', p_batch, p_subject;
  end if;

  select b.id into v_id
    from public.content_buckets b
   where b.batch = p_batch
     and b.subject = p_subject
     and lower(trim(b.name)) = lower(v_name);

  if v_id is not null then
    return v_id;
  end if;

  insert into public.content_buckets (batch, subject, name, position, created_by)
  values (
    p_batch,
    p_subject,
    v_name,
    coalesce((select max(b2.position) + 1
                from public.content_buckets b2
               where b2.batch = p_batch and b2.subject = p_subject), 0),
    auth.uid()
  )
  on conflict (batch, subject, lower(trim(name))) do nothing
  returning id into v_id;

  -- Lost a race with a concurrent insert — read the winner back.
  if v_id is null then
    select b.id into v_id
      from public.content_buckets b
     where b.batch = p_batch
       and b.subject = p_subject
       and lower(trim(b.name)) = lower(v_name);
  end if;

  return v_id;
end;
$$;

comment on function public.ensure_bucket(text, text, text) is
  'Get-or-create a bucket for one (batch, subject). Idempotent and race-safe.';

create or replace function public.ensure_bucket_group(
  p_batch   text,
  p_subject text,
  p_name    text
)
returns table (bucket_batch text, bucket_subject text, bucket_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- get_merged_pairs already returns the originating pair plus every pair in
  -- its active merge closure, so this covers the un-merged case too.
  for r in select * from public.get_merged_pairs(p_batch, p_subject) loop
    bucket_batch   := r.batch;
    bucket_subject := r.subject;
    bucket_id      := public.ensure_bucket(r.batch, r.subject, p_name);
    return next;
  end loop;
end;
$$;

comment on function public.ensure_bucket_group(text, text, text) is
  'Get-or-create a same-named bucket in every batch of the merge group. Used at Go Live.';

revoke all on function public.ensure_bucket(text, text, text) from public, anon;
revoke all on function public.ensure_bucket_group(text, text, text) from public, anon;
grant execute on function public.ensure_bucket(text, text, text) to authenticated, service_role;
grant execute on function public.ensure_bucket_group(text, text, text) to authenticated, service_role;
