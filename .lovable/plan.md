

# Show All Schedules to Students (Read-Only View)

## Problem
Currently, the `StudentSchedule` component only shows schedules for the student's enrolled batch+subject pairs. The user wants students to see **all** scheduled classes across all batches and subjects as a read-only timetable.

## Changes

### File: `src/components/student/StudentSchedule.tsx`

1. **Replace enrollment-filtered query with a full fetch** -- Remove the `enrollmentPairs` dependency and the `.or(orFilter)` logic. Instead, fetch all schedules directly:
   ```ts
   supabase.from('schedules').select('*')
     .order('day_of_week').order('start_time')
   ```

2. **Remove enrollment-related code** -- Remove the `userEnrollments` query, `enrollmentPairs` memo, and `availableBatches` memo since they're no longer needed for filtering.

3. **Replace batch filter with a dynamic batch filter from all schedules** -- Instead of filtering by enrolled batches, derive available batches from the fetched schedules data itself so students can still filter the view by batch if desired.

4. **Remove the join link** -- Since students should only see timings (not access classes they aren't enrolled in), hide the "Join Class" / "Join Live" button from the schedule grid. This keeps it as a read-only timetable.

### Database: Add an RLS policy for public schedule viewing
The existing RLS on `schedules` restricts students to their enrolled batch+subject. We need to add a new SELECT policy that allows all authenticated students to read all schedule rows (for the schedule view only):

```sql
CREATE POLICY "Students can view all schedules"
ON public.schedules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role::text = 'student'
  )
);
```

## Summary
| Area | Change |
|---|---|
| `StudentSchedule.tsx` | Fetch all schedules without enrollment filter, derive batch list from data, hide join buttons |
| Database (RLS) | Add policy allowing all students to SELECT from schedules |

This gives students a complete view of the institute's timetable while keeping actual class access (join links, live classes, recordings, etc.) restricted to their enrolled subjects.
