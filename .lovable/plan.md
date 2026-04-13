

# Plan: Fix Community Groups Visibility + Teacher Add Class Step-by-Step Filter

## Issue 1: Community Groups Not Visible (1000-row limit)

**Root Cause**: `AdminCommunity.tsx` line 341 fetches ALL rows from `user_enrollments` to build the group list. With 1712 enrollments, Supabase's default 1000-row limit truncates results, hiding some batch/subject combinations.

**Fix**: Replace the raw `user_enrollments` query with the existing `get_distinct_enrollment_options` RPC (already used by AdminCreateAnnouncement and AdminStaffManager). This RPC is a SECURITY DEFINER function that returns distinct batch/subject pairs without hitting the 1000-row limit.

### Files to change:
- **`src/components/admin/AdminCommunity.tsx`** (line ~341): Replace `supabase.from('user_enrollments').select(...)` with `supabase.rpc('get_distinct_enrollment_options')` and map the result to `{ batch_name, subject_name }` format.

Student and Teacher community components are unaffected -- students query only their own enrollments (small set), and teachers derive groups from the `teachers` table.

---

## Issue 2: Teacher Add Class -- Step-by-Step Batch/Subject Selection

**Current Behavior**: The `AddClassForm` in `TeacherSchedule.tsx` shows ALL assigned batches and ALL assigned subjects independently. Teachers can pick any combination, even invalid ones.

**New Behavior**: Step-by-step wizard:
1. **Step 1**: Select Batch (from `teacher.assigned_batches`)
2. **Step 2**: Select Subject -- filtered to only show subjects that exist for the selected batch. Cross-reference `teacher.assigned_subjects` with actual `schedules` or `user_enrollments` for that batch.
3. **Step 3**: Fill in date and time (same as current)

### Files to change:
- **`src/components/teacher/TeacherSchedule.tsx`** (`AddClassForm` component, lines 82-271):
  - Add state for `selectedBatch` that gates subject visibility
  - Query distinct subjects for the selected batch from the `schedules` table (or `user_enrollments`)
  - Intersect with `assignedSubjects` to show only valid options
  - Reset subject when batch changes
  - Disable subject select until batch is chosen
  - Show subjects only after batch selection (step-by-step UX)

### Technical approach:
```
1. User selects Batch -> sets newClass.batch
2. Filter assignedSubjects: for each subject, check if it exists in schedules/user_enrollments for that batch
3. If no schedule history exists, fall back to showing all assigned subjects for that batch
4. Subject dropdown is disabled/hidden until batch is selected
5. Changing batch resets subject selection
```

No database changes required.

