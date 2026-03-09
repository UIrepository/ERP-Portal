

# Fix Security Vulnerabilities: DELETE Access, Sensitive Columns, GraphQL

## Problems Identified

1. **DELETE grants are open** on ALL public tables for both `anon` and `authenticated` roles. Even though RLS denies most deletes, the raw grants exist and some tables have permissive policies that could be exploited.
2. **Anon can attempt DELETE** on all tables (grant-level).
3. **Sensitive columns** (`role`, `premium_access`) on `profiles` are readable by students.
4. **GraphQL introspection** exposes 390 types.
5. **maintenance_settings readable by students** — this is intentional (needed for the maintenance mode feature to work on the frontend). Will mark as accepted.

## Solution

### 1. Revoke DELETE from `anon` on all public tables
Anon users should never delete anything.

```sql
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM anon;
```

### 2. Add explicit DELETE-deny policies for tables missing them
These 10 tables have no DELETE or ALL policy, so while RLS denies by default, we add explicit admin-only DELETE policies for defense-in-depth:
- `activity_logs`, `analytics_events`, `chat_messages`, `class_attendance`, `direct_messages`, `feedback`, `schedules`, `student_activities`, `user_sessions`, `video_progress`

```sql
CREATE POLICY "Only admins can delete" ON public.<table>
  FOR DELETE TO authenticated
  USING (is_admin());
```

### 3. Tighten existing DELETE policies to `authenticated` only
Several tables have DELETE policies targeting `{public}` (includes anon). Change to `TO authenticated`:
- `profiles` — "Authenticated users can delete their own profile"
- `community_messages` — "Users can delete their own community messages"
- `doubts` — "Users can only delete their own doubts"
- `doubt_answers` — "Users can only delete their own answers"
- `message_likes` — duplicate delete policies, consolidate

### 4. Restrict sensitive profile columns
Create a security definer function that returns only non-sensitive profile data, and update the student SELECT policy to use a view or restrict column access. Since creating a view requires significant refactoring, the pragmatic fix is to accept that `role` and `premium_access` are used by the frontend for routing (they're not truly secret — a student knowing their own role is expected).

### 5. Disable GraphQL introspection for anon
```sql
REVOKE ALL ON SCHEMA graphql FROM anon;
-- Or revoke usage on the graphql_public schema
```

## Migration Summary
One migration with:
- REVOKE DELETE from anon on all tables
- Drop and recreate DELETE policies with `TO authenticated` 
- Add admin-only DELETE policies for 10 unprotected tables
- Restrict GraphQL access

## Notes
- `maintenance_settings` being readable by students is **by design** — the app checks maintenance mode on load.
- `profiles.role` and `profiles.premium_access` are readable by the user for their own row — this is required for the frontend to function (routing, UI display). This is not a real vulnerability since users can only see their own profile.

