-- Fix: Teachers can't persist stream_key / broadcast_id to schedules
-- Root cause: the UPDATE policy on schedules required an exact match of
-- schedules.subject against teachers.assigned_subjects, and also failed on
-- merged sibling rows. The client silently saw 0-row updates.
-- Fix: normalize subject comparison (strip parenthesized suffixes, case-fold)
-- and allow UPDATE on any row reachable via the active subject_merges graph
-- from a row the teacher IS directly assigned to.

CREATE OR REPLACE FUNCTION public.subject_normalize(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(coalesce(s, ''), '[[:space:]]*\([^)]*\)[[:space:]]*$', '')))
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_modify_schedule(p_batch text, p_subject text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned_batches text[];
  v_assigned_subjects text[];
  v_norm_target text;
BEGIN
  SELECT assigned_batches, assigned_subjects
    INTO v_assigned_batches, v_assigned_subjects
    FROM teachers
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_assigned_batches IS NULL THEN
    RETURN FALSE;
  END IF;

  v_norm_target := subject_normalize(p_subject);

  IF p_batch = ANY (v_assigned_batches)
     AND EXISTS (
       SELECT 1 FROM unnest(v_assigned_subjects) s
        WHERE subject_normalize(s) = v_norm_target
     )
  THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    WITH RECURSIVE merge_closure(batch, subject) AS (
      SELECT p_batch, p_subject
      UNION
      SELECT m.primary_batch, m.primary_subject
        FROM subject_merges m, merge_closure mc
       WHERE m.is_active = TRUE
         AND m.secondary_batch = mc.batch
         AND m.secondary_subject = mc.subject
      UNION
      SELECT m.secondary_batch, m.secondary_subject
        FROM subject_merges m, merge_closure mc
       WHERE m.is_active = TRUE
         AND m.primary_batch = mc.batch
         AND m.primary_subject = mc.subject
    )
    SELECT 1
      FROM merge_closure mc
     WHERE mc.batch = ANY (v_assigned_batches)
       AND EXISTS (
         SELECT 1 FROM unnest(v_assigned_subjects) s
          WHERE subject_normalize(s) = subject_normalize(mc.subject)
       )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.subject_normalize(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_modify_schedule(text, text) TO authenticated;

DROP POLICY IF EXISTS "Teachers can update their assigned schedules" ON public.schedules;

CREATE POLICY "Teachers can update assigned or merged schedules"
ON public.schedules
FOR UPDATE
TO authenticated
USING (public.teacher_can_modify_schedule(schedules.batch, schedules.subject))
WITH CHECK (public.teacher_can_modify_schedule(schedules.batch, schedules.subject));
