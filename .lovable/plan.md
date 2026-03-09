

# Fix: Access Denied + Recordings 500 Errors

## Problem 1: "Access Denied" for All Users
**Root cause**: `StudentDashboard` checks `profile?.role !== 'student'`, but `profile` is null when the profile fetch fails or is slow. The other dashboards (Admin, Manager) correctly use `resolvedRole` instead. When the profile fetch fails silently, `resolvedRole` still works (from cache or RPC), but `profile` is null → Access Denied.

**Fix**: Change `StudentDashboard` to use `resolvedRole` like the other dashboards.

## Problem 2: Recordings & Notes 500 Errors
**Root cause**: The frontend queries recordings/notes using merged batch+subject pairs (e.g., querying both "Foundation Quiz 1 - Data Science" and "Crash Course DS Qualifier - January" for the same subject). But the RLS policies on `recordings` and `notes` only check direct `user_enrollments` — they don't account for `subject_merges`. So if a student is enrolled in Batch A and Batch B is merged with it, recordings from Batch B are blocked by RLS, causing 500 errors.

**Fix**: Add merge-aware SELECT policies on `recordings` and `notes` (same pattern used for `active_classes`, `meeting_links`, and `doubts`).

## Problem 3: Stale `get_current_user_role()` Policy
One remaining policy on `schedules` still uses `get_current_user_role()`. Drop it since admins already have access via the "Admins can view all schedules directly" policy.

---

## Changes

### Frontend (1 file)
**`src/components/StudentDashboard.tsx`**
- Change `profile?.role !== 'student'` → `resolvedRole !== 'student'`
- Import `resolvedRole` from `useAuth()`

### Database Migration
```sql
-- 1. Recordings: add merge-aware SELECT
CREATE POLICY "Merged students can view recordings"
  ON public.recordings FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subject_merges sm
      JOIN user_enrollments ue ON ue.user_id = auth.uid()
      WHERE sm.is_active = true
        AND (
          (sm.primary_batch = recordings.batch AND sm.primary_subject = recordings.subject
           AND sm.secondary_batch = ue.batch_name AND sm.secondary_subject = ue.subject_name)
          OR
          (sm.secondary_batch = recordings.batch AND sm.secondary_subject = recordings.subject
           AND sm.primary_batch = ue.batch_name AND sm.primary_subject = ue.subject_name)
        )
    )
  );

-- 2. Notes: add merge-aware SELECT
CREATE POLICY "Merged students can view notes"
  ON public.notes FOR SELECT USING (...same pattern...);

-- 3. Drop stale schedules policy
DROP POLICY IF EXISTS "Super admins can view all schedules" ON public.schedules;

-- 4. Schema reload
NOTIFY pgrst, 'reload schema';
```

