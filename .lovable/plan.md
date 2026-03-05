

# Fix: Merged Batch Recordings -- Multi-way Merges, Duplicate Streams, and Pre-merge Isolation

## Problems Identified

### Problem A: N-way merges create duplicate streams (Teacher side)
The current teacher dedup logic handles **pairwise** merges only. For Mathematics 1, there are **4 batches** merged together via 3 merge records all sharing the same primary. The dedup loop finds one partner, consumes it, but leaves the remaining 2 schedules as separate cards. The teacher can click "Start Class" on each, creating 3 separate YouTube streams and 3 recordings.

### Problem B: `get_merged_pairs` DB function misses transitive partners (Student side)
When a student from "Crash Course DS Qualifier" calls `get_merged_pairs`, it only returns itself + "Foundation Quiz 1" (the direct partner). It does NOT return "Qualifier January 2026" or "Crash Course Quiz 1" which are also in the same merge group via transitive connection. This means that student doesn't see all recordings.

### Problem C: Pre-merge recordings leak into newly merged combinations
When batches are merged today, the OR filter pulls ALL historical recordings from partner batches. Students in a newly merged batch suddenly see recordings from before they were even merged. Need to filter: only show partner recordings created **after** the merge date.

### Problem D: Build error in `send-class-reminders`
The `npm:resend@2.0.0` import needs a deno.json or to use the esm.sh pattern.

---

## Plan

### 1. Update `get_merged_pairs` DB function (Migration)

Replace the current function with one that computes transitive closure AND returns `merged_at` timestamp:

```sql
CREATE OR REPLACE FUNCTION public.get_merged_pairs(p_batch text, p_subject text)
RETURNS TABLE(batch text, subject text, merged_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- Return self with NULL merged_at (always show own recordings)
  RETURN QUERY SELECT p_batch, p_subject, NULL::timestamptz;
  
  -- Recursive CTE: find all transitive merge partners
  RETURN QUERY
  WITH RECURSIVE merge_group AS (
    -- Direct partners of the input
    SELECT sm.primary_batch AS b, sm.primary_subject AS s, sm.created_at AS ma
    FROM subject_merges sm
    WHERE sm.is_active AND sm.secondary_batch = p_batch AND sm.secondary_subject = p_subject
    UNION
    SELECT sm.secondary_batch, sm.secondary_subject, sm.created_at
    FROM subject_merges sm
    WHERE sm.is_active AND sm.primary_batch = p_batch AND sm.primary_subject = p_subject
    UNION
    -- Transitive: partners of partners
    SELECT sm.secondary_batch, sm.secondary_subject, sm.created_at
    FROM subject_merges sm
    JOIN merge_group mg ON sm.primary_batch = mg.b AND sm.primary_subject = mg.s
    WHERE sm.is_active
    UNION
    SELECT sm.primary_batch, sm.primary_subject, sm.created_at
    FROM subject_merges sm
    JOIN merge_group mg ON sm.secondary_batch = mg.b AND sm.secondary_subject = mg.s
    WHERE sm.is_active
  )
  SELECT mg.b, mg.s, mg.ma FROM merge_group mg
  WHERE NOT (mg.b = p_batch AND mg.s = p_subject);
END;
$$;
```

This returns each partner with its `merged_at` date. The self-pair has `merged_at = NULL`.

### 2. Update `useMergedSubjects` hook

- Update the `MergedPair` interface to include `merged_at: string | null`
- Pass `merged_at` through in the return value
- Keep `orFilter` and `primaryPair` logic unchanged

### 3. Update `StudentRecordings` -- Filter by merge date

After fetching recordings with the OR filter (which gets recordings from all merged pairs):
- For each recording, check if it belongs to the student's OWN batch/subject -- always keep it
- For recordings from PARTNER batches, check the `merged_at` date from `mergedPairs` -- only keep if recording `date >= merged_at`
- This ensures pre-merge recordings from partner batches are excluded
- Lecture numbering is already dynamic (`filteredRecordings.length - index`) so it auto-adjusts

### 4. Update `TeacherJoinClass` -- N-way merge group dedup

Replace the pairwise dedup logic with a **group-based** approach:
- Build a map of merge groups from `activeMerges` using union-find / transitive closure
- For each group, find ALL schedules that belong to it
- Create ONE deduped card per group with all batch/subject pairs in `mergedBatches`
- Propagate `stream_key`/`broadcast_id` from any schedule in the group

### 5. Fix `send-class-reminders` build error

Change `import { Resend } from 'npm:resend@2.0.0'` to use esm.sh:
```typescript
import { Resend } from 'https://esm.sh/resend@2.0.0';
```

---

## Files Changed

| File | Change |
|------|--------|
| **Migration** | Replace `get_merged_pairs` function with transitive closure + `merged_at` |
| `src/hooks/useMergedSubjects.ts` | Add `merged_at` to `MergedPair` interface |
| `src/components/student/StudentRecordings.tsx` | Filter partner recordings by merge date |
| `src/components/teacher/TeacherJoinClass.tsx` | N-way merge group dedup logic |
| `supabase/functions/send-class-reminders/index.ts` | Fix resend import |

