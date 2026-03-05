

# Fix: Broken `get_merged_pairs` Database Function

## Root Cause

The `get_merged_pairs` recursive CTE deployed in the last migration has **invalid SQL syntax**. PostgreSQL requires a recursive CTE to have exactly two parts separated by a single `UNION [ALL]`:
1. A non-recursive seed (no self-reference)
2. A recursive term (references the CTE)

The current function has 4 branches all connected with `UNION`, where branches 3 and 4 reference `merge_group` but PostgreSQL treats all 4 as the non-recursive term, causing error `42P19`.

**Impact**: Every call to `get_merged_pairs` fails. The `useMergedSubjects` hook catches the error and falls back to returning only the student's own batch/subject. The OR filter then only matches their own batch, so recordings saved under any merged partner batch are invisible.

## Fix

### 1. Migration: Replace `get_merged_pairs` with valid recursive CTE

The non-recursive seeds (direct partners) must be wrapped in a subquery, then joined to the recursive part with a single `UNION`:

```sql
CREATE OR REPLACE FUNCTION public.get_merged_pairs(p_batch text, p_subject text)
RETURNS TABLE(batch text, subject text, merged_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- Self pair (always visible, no merge date restriction)
  RETURN QUERY SELECT p_batch, p_subject, NULL::timestamptz;

  -- All transitive partners via valid recursive CTE
  RETURN QUERY
  WITH RECURSIVE merge_group AS (
    -- SEED: direct partners (wrapped as single non-recursive term)
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

    UNION  -- deduplicates, prevents infinite loops

    -- RECURSIVE: find the "other side" of merge records matching known members
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
```

### 2. No frontend changes needed

The existing `useMergedSubjects` hook, `StudentRecordings` merge-date filter, and `TeacherJoinClass` N-way dedup logic are all correct -- they just weren't getting data because the DB function was broken. Once the function works:

- Students will see recordings from all merged partner batches (filtered by merge date)
- Lecture numbering auto-adjusts (already uses `filteredRecordings.length - index`)
- Teacher dedup will get correct merge groups from the function

## Files Changed

| File | Change |
|------|--------|
| New migration | Replace `get_merged_pairs` with valid recursive CTE syntax |

