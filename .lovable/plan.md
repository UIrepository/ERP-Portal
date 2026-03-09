

# Fix: Infinite Recursion in Managers RLS Policy

## Root Cause
The `managers` table policy "Staff can view all managers" contains:
```sql
EXISTS (SELECT 1 FROM managers managers_1 WHERE managers_1.user_id = auth.uid())
```
This is a **self-referencing query** — a SELECT policy on `managers` that queries `managers` itself — causing infinite recursion. Every query that indirectly touches managers (profiles, recordings, notes) also fails with 500.

## Fix
Drop and recreate the policy using the existing `is_manager()` security definer function, which bypasses RLS:

```sql
DROP POLICY IF EXISTS "Staff can view all managers" ON public.managers;

CREATE POLICY "Staff can view all managers"
  ON public.managers FOR SELECT
  USING (
    is_admin() OR is_manager()
  );
```

## Impact
- Fixes profiles 500 error → students see their profile and batches
- Fixes recordings/notes 500 error → content loads correctly
- No frontend changes needed

