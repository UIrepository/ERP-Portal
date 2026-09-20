-- Let teachers edit recordings for the subjects they teach.
--
-- recordings had SELECT policies for teachers and an INSERT policy ("Enable
-- insert for teachers and admins") but NO UPDATE policy for anyone except
-- admins. A teacher moving a lecture into a different week therefore ran an
-- UPDATE that matched zero rows: PostgREST reports success, the UI says
-- "Moved", and nothing changes. Silent no-op, the worst kind.
--
-- Shape copied from the existing "Teachers can manage notes for their subjects"
-- policy so both content types behave the same: a teacher may edit rows whose
-- batch AND subject are both in their assignment, and nothing else.

drop policy if exists "Teachers can update recordings for their subjects" on public.recordings;
create policy "Teachers can update recordings for their subjects"
  on public.recordings
  for update
  using (
    exists (
      select 1 from public.teachers t
       where t.user_id = auth.uid()
         and recordings.batch   = any (t.assigned_batches)
         and recordings.subject = any (t.assigned_subjects)
    )
  )
  with check (
    exists (
      select 1 from public.teachers t
       where t.user_id = auth.uid()
         and recordings.batch   = any (t.assigned_batches)
         and recordings.subject = any (t.assigned_subjects)
    )
  );
