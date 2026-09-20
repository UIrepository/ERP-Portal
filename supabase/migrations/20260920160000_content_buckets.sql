-- Buckets: the week / chapter groupings a teacher puts lectures and notes into.
--
-- A bucket belongs to one subject inside one batch. "Week 1" in Mathematics 1
-- is a different row from "Week 1" in Statistics 1, and from "Week 1" in the
-- same subject in another batch. That matches how every other content table in
-- this portal is keyed (the batch + subject text pair), so merges, RLS and the
-- existing queries all keep working the same way.
--
-- Names are whatever the teacher types — Week 1, Chapter 3, Revision. There is
-- no fixed list of bucket names anywhere in the schema or the code.
--
-- There is deliberately NO "Unsorted" bucket row. An item that has not been
-- filed simply has bucket_id = null, and the student and teacher screens render
-- those under a trailing "Unsorted" heading. Keeping the empty state as null
-- rather than a magic row means nothing can create a duplicate Unsorted, nobody
-- can rename or delete it by accident, and the 2,900 rows that already exist
-- need no migration.

create table if not exists public.content_buckets (
  id          uuid primary key default gen_random_uuid(),
  batch       text not null,
  subject     text not null,
  name        text not null check (length(trim(name)) > 0),
  position    integer not null default 0,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.content_buckets is
  'Teacher-defined week/chapter groupings for a (batch, subject). Items with bucket_id null are shown as "Unsorted".';

-- One bucket per name per subject, case-insensitively, so "week 1" and "Week 1"
-- cannot both exist and split a week in half.
create unique index if not exists content_buckets_unique_name
  on public.content_buckets (batch, subject, lower(trim(name)));

create index if not exists content_buckets_lookup
  on public.content_buckets (batch, subject, position, created_at);

alter table public.content_buckets enable row level security;

-- Students see the buckets of subjects they are enrolled in, directly or
-- through an active merge — the same test the recordings and notes policies use.
drop policy if exists "Students can view buckets for their enrollments" on public.content_buckets;
create policy "Students can view buckets for their enrollments"
  on public.content_buckets
  for select
  using (
    exists (
      select 1 from public.user_enrollments ue
       where ue.user_id = auth.uid()
         and ue.batch_name   = content_buckets.batch
         and ue.subject_name = content_buckets.subject
    )
    or exists (
      select 1
        from public.subject_merges sm
        join public.user_enrollments ue on ue.user_id = auth.uid()
       where sm.is_active
         and (
              (sm.primary_batch     = content_buckets.batch
           and sm.primary_subject   = content_buckets.subject
           and sm.secondary_batch   = ue.batch_name
           and sm.secondary_subject = ue.subject_name)
            or
              (sm.secondary_batch   = content_buckets.batch
           and sm.secondary_subject = content_buckets.subject
           and sm.primary_batch     = ue.batch_name
           and sm.primary_subject   = ue.subject_name)
         )
    )
  );

drop policy if exists "Teachers manage buckets for their subjects" on public.content_buckets;
create policy "Teachers manage buckets for their subjects"
  on public.content_buckets
  for all
  using (
    exists (
      select 1 from public.teachers t
       where t.user_id = auth.uid()
         and content_buckets.batch   = any (t.assigned_batches)
         and content_buckets.subject = any (t.assigned_subjects)
    )
  )
  with check (
    exists (
      select 1 from public.teachers t
       where t.user_id = auth.uid()
         and content_buckets.batch   = any (t.assigned_batches)
         and content_buckets.subject = any (t.assigned_subjects)
    )
  );

drop policy if exists "Admins manage all buckets" on public.content_buckets;
create policy "Admins manage all buckets"
  on public.content_buckets
  for all
  using      (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Managers run batch operations day to day; let them read buckets so the
-- overview screens can group the same way the student sees.
drop policy if exists "Managers can view buckets" on public.content_buckets;
create policy "Managers can view buckets"
  on public.content_buckets
  for select
  using (exists (select 1 from public.managers m where m.user_id = auth.uid()));
