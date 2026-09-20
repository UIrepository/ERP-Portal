-- Point content at a bucket.
--
-- recordings / notes: which week the item belongs to. Null means "Unsorted",
-- which is how every one of the 2,900 existing rows starts out — nothing is
-- rewritten and nothing disappears from the student's view.
--
-- schedules: the relay. When a teacher picks a bucket at Go Live we stamp it on
-- the schedule too, so the whiteboard-to-notes automation can read it back
-- later and file the note in the same week without asking the teacher twice.
--
-- on delete set null: deleting a bucket un-files its items rather than deleting
-- the lecture along with the grouping.

alter table public.recordings
  add column if not exists bucket_id uuid references public.content_buckets (id) on delete set null;

alter table public.notes
  add column if not exists bucket_id uuid references public.content_buckets (id) on delete set null;

alter table public.schedules
  add column if not exists bucket_id uuid references public.content_buckets (id) on delete set null;

comment on column public.recordings.bucket_id is 'Week/chapter bucket. Null = Unsorted.';
comment on column public.notes.bucket_id      is 'Week/chapter bucket, inherited from the class schedule for whiteboard notes. Null = Unsorted.';
comment on column public.schedules.bucket_id  is 'Bucket chosen by the teacher at Go Live; whiteboard notes inherit it.';

-- The student screens fetch one subject at a time and group by bucket, so the
-- useful index is the lookup they actually run.
create index if not exists recordings_bucket_idx on public.recordings (batch, subject, bucket_id);
create index if not exists notes_bucket_idx      on public.notes      (batch, subject, bucket_id);
