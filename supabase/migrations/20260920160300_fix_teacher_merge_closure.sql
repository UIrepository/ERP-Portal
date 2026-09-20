-- Fix teacher_can_modify_schedule(): it throws instead of answering.
--
-- The merge-closure CTE referenced itself in TWO recursive UNION branches (one
-- walking primary -> secondary, one secondary -> primary). Postgres allows a
-- recursive CTE exactly one self-reference, so any call that got as far as the
-- closure died with:
--
--   42P19: recursive reference to query "merge_closure" must not appear more than once
--
-- The direct-assignment check above it returns early, which is why this stayed
-- hidden: it only fires when a teacher is NOT directly assigned to the pair —
-- exactly the merged-class case the function exists to allow. So today a
-- teacher editing a merged schedule gets an error rather than permission, and
-- the new bucket helpers inherited the same failure.
--
-- Collapsed into a single recursive branch that walks both directions with a
-- CASE, which is the pattern get_merged_pairs() already uses successfully.
-- Behaviour is otherwise unchanged.

create or replace function public.teacher_can_modify_schedule(
  p_batch   text,
  p_subject text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
DECLARE
  v_assigned_batches  text[];
  v_assigned_subjects text[];
  v_norm_target       text;
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
      SELECT
        CASE WHEN m.primary_batch = mc.batch AND m.primary_subject = mc.subject
             THEN m.secondary_batch ELSE m.primary_batch END,
        CASE WHEN m.primary_batch = mc.batch AND m.primary_subject = mc.subject
             THEN m.secondary_subject ELSE m.primary_subject END
        FROM subject_merges m
        JOIN merge_closure mc
          ON (m.primary_batch   = mc.batch AND m.primary_subject   = mc.subject)
          OR (m.secondary_batch = mc.batch AND m.secondary_subject = mc.subject)
       WHERE m.is_active = TRUE
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
