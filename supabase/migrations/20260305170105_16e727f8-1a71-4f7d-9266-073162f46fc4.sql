CREATE OR REPLACE FUNCTION public.get_merged_pairs(p_batch text, p_subject text)
RETURNS TABLE(batch text, subject text, merged_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY SELECT p_batch, p_subject, NULL::timestamptz;

  RETURN QUERY
  WITH RECURSIVE merge_group AS (
    SELECT seed.b, seed.s, seed.ma FROM (
      SELECT sm.primary_batch AS b, sm.primary_subject AS s, sm.created_at AS ma
      FROM subject_merges sm
      WHERE sm.is_active
        AND sm.secondary_batch = p_batch AND sm.secondary_subject = p_subject
      UNION
      SELECT sm.secondary_batch, sm.secondary_subject, sm.created_at
      FROM subject_merges sm
      WHERE sm.is_active
        AND sm.primary_batch = p_batch AND sm.primary_subject = p_subject
    ) seed

    UNION

    SELECT
      CASE WHEN sm.primary_batch = mg.b AND sm.primary_subject = mg.s
           THEN sm.secondary_batch ELSE sm.primary_batch END,
      CASE WHEN sm.primary_batch = mg.b AND sm.primary_subject = mg.s
           THEN sm.secondary_subject ELSE sm.primary_subject END,
      sm.created_at
    FROM subject_merges sm
    JOIN merge_group mg ON
      (sm.primary_batch = mg.b AND sm.primary_subject = mg.s)
      OR (sm.secondary_batch = mg.b AND sm.secondary_subject = mg.s)
    WHERE sm.is_active
  )
  SELECT mg.b, mg.s, mg.ma FROM merge_group mg
  WHERE NOT (mg.b = p_batch AND mg.s = p_subject);
END;
$$;