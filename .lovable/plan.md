

# Fix: "No Batch Selected" Due to Profile Fetch Failure

## Root Cause
The profile fetch from the `profiles` table is returning a 500 error. Since critical components (`StudentMain`, `Sidebar`, `NotificationListener`, etc.) depend on `profile?.user_id` to load enrollments, when profile is null everything downstream breaks — no enrollments load, so "No Batch Selected" appears.

The `user` object from Supabase Auth (session-based) is always available when logged in and contains `user.id` — the same UUID. Using it instead of `profile?.user_id` makes the app resilient to profile fetch failures.

## Why profiles returns 500
The `user_role` enum is missing `'teacher'` — it only has `student, super_admin, manager, admin`. If any profile row was inserted before this enum change with a `teacher` role via the old enum, PostgREST could fail serializing it. However, the immediate priority is making the app work regardless of profile fetch status.

## Changes

### 1. Fix `StudentMain.tsx` — use `user.id` instead of `profile?.user_id`
- Import `user` from `useAuth()` alongside `profile`
- Replace `profile?.user_id` with `user?.id` in the enrollments query, queryKey, enabled check, and realtime subscription

### 2. Fix `Sidebar.tsx` — same pattern
- Replace `profile?.user_id` with `user?.id` for enrollment fetching and realtime subscriptions

### 3. Database: Add `'teacher'` to the `user_role` enum
This likely fixes the 500 on profiles table:
```sql
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'teacher';
NOTIFY pgrst, 'reload schema';
```

### 4. Database: Another schema reload
Force PostgREST cache refresh after enum fix.

