-- Teacher "Resources" tab: let teachers read DPP and UI Ki Padhai content for
-- the batch+subject combinations they're assigned to. (Students/admins already
-- have read policies; notes already has a teacher policy.) Mirrors the direct
-- batch/subject match used by the teacher recordings view.
create policy "Teachers can view dpp_content for their subjects"
on public.dpp_content for select to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.user_id = auth.uid()
      and dpp_content.batch = any (t.assigned_batches)
      and dpp_content.subject = any (t.assigned_subjects)
  )
);

create policy "Teachers can view ui_ki_padhai_content for their subjects"
on public.ui_ki_padhai_content for select to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.user_id = auth.uid()
      and ui_ki_padhai_content.batch = any (t.assigned_batches)
      and ui_ki_padhai_content.subject = any (t.assigned_subjects)
  )
);
