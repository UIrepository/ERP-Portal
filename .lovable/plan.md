

# Fix: Infinite Recursion in Teachers RLS Policy

## Problem
The `teachers` table has a "Staff can view all teachers" policy that self-references:
```
EXISTS (SELECT 1 FROM teachers teachers_1 WHERE teachers_1.user_id = auth.uid())
```
This is the exact same pattern we just fixed on the `managers` table. Any query that touches `teachers` (recordings, notes, active_classes, meeting_links, etc.) triggers infinite recursion and returns 500.

## Fix
Drop and recreate the policy using the existing `is_teacher()` security definer function:

```sql
DROP POLICY IF EXISTS "Staff can view all teachers" ON public.teachers;

CREATE POLICY "Staff can view all teachers"
  ON public.teachers FOR SELECT
  USING (is_admin() OR is_manager() OR is_teacher());

NOTIFY pgrst, 'reload schema';
```

## Impact
- Fixes 500 errors on recordings, notes, and all tables whose RLS references `teachers`
- No frontend changes needed

