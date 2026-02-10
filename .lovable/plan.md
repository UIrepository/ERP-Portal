

# Fix: Students Seeing Non-Enrolled Subjects

## Problem
Students enrolled in specific subjects within a batch are seeing ALL subjects in that batch. The root cause is in the **`StudentLiveClass`** component and certain **RLS policies** that filter by batch only, not by the batch+subject enrollment pair.

## Root Cause Analysis

### 1. StudentLiveClass (Batch-Level Mode) -- Code Bug
In `StudentLiveClass.tsx` (lines 47-54), when rendering at the batch level (no subject selected), it fetches ALL schedules, meeting links, and active classes for the entire batch:
```js
supabase.from('schedules').select('*').eq('batch', batch)
```
This shows classes for subjects the student is NOT enrolled in.

### 2. RLS Policies -- Overly Permissive
The `schedules` table has a policy `Students can view schedules for their enrolled batches` that only checks batch membership, not subject enrollment. Similarly, the `active_classes` and `meeting_links` tables have no subject-level enrollment checks.

## Fix Plan

### Step 1: Fix StudentLiveClass Batch-Level Query
Pass `enrolledSubjects` (already available in `StudentMain`) to `StudentLiveClass`, then filter queries to only include enrolled subjects using `.in('subject', enrolledSubjects)`.

**File:** `src/components/student/StudentLiveClass.tsx`
- Add `enrolledSubjects` prop
- In batch-level mode, add `.in('subject', enrolledSubjects)` to the schedules, meeting_links, and active_classes queries
- This ensures only enrolled subjects appear in the "Join Live Class" tab

### Step 2: Pass enrolledSubjects from StudentMain
**File:** `src/components/student/StudentMain.tsx`
- Pass `enrolledSubjects={subjectsForBatch}` to `StudentLiveClass` (the array is already computed at line 132)

### Step 3: Tighten RLS Policy on Schedules
Drop the overly permissive batch-only policy and ensure the subject-level policy remains:
- **Drop:** `Students can view schedules for their enrolled batches` (checks batch only)
- **Keep:** `Students can view schedules for their enrollments` (checks batch AND subject)

### Step 4: Fix Legacy Components Using profile.batch/subjects
Three components still use the old `profile.batch` / `profile.subjects` fields instead of `user_enrollments`:
- `StudentChatTeacher.tsx` -- uses `profile.batch` and `profile.subjects` for filtering
- `StudentChatFounder.tsx` -- uses `profile.batch` for metadata
- `StudentExtraClasses.tsx` -- uses `profile.batch` and `profile.subjects` for display

These should be updated to fetch from `user_enrollments` for accuracy, or at minimum receive the correct data as props.

## Technical Details

### Database Migration (Step 3)
```sql
-- Drop overly permissive batch-only policy
DROP POLICY IF EXISTS "Students can view schedules for their enrolled batches" ON schedules;

-- The existing policy "Students can view schedules for their enrollments" 
-- already checks both batch AND subject via user_enrollments, so it stays.
```

### Code Changes Summary
| File | Change |
|---|---|
| `StudentLiveClass.tsx` | Add `enrolledSubjects` prop, filter batch-level queries by enrolled subjects |
| `StudentMain.tsx` | Pass `enrolledSubjects={subjectsForBatch}` to `StudentLiveClass` |
| `StudentChatTeacher.tsx` | Replace `profile.batch`/`profile.subjects` with `user_enrollments` query |
| `StudentChatFounder.tsx` | Replace `profile.batch` with batch from enrollments |
| `StudentExtraClasses.tsx` | Replace `profile.batch`/`profile.subjects` with enrollments data |

### What stays unchanged
- `StudentMain.tsx` subject card grid -- already correctly uses `user_enrollments`
- `StudentSchedule.tsx` -- already correctly uses `user_enrollments` enrollment pairs with batch+subject OR filter
- `StudentRecordings.tsx` -- only called at subject level with explicit batch+subject props
- `StudentAnnouncements.tsx` -- receives `enrolledSubjects` prop and filters correctly

