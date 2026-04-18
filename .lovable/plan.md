

## Root Cause Analysis

### Bug 1: Teachers seeing student interface (e.g., tanushribadoni2@gmail.com)

Tanushri's data:
- `auth.users`: id `4131c303...` ✅
- `teachers` table: `user_id = 4131c303...`, properly linked ✅
- `profiles.role = 'super_admin'` (legacy/manual value, but she's NOT in admins table)

The role-resolution flow has **three serious bugs**:

**A. `get_user_role_from_tables` RPC ignores its parameter.** It declares `actual_user_id := auth.uid()` and never uses the passed `check_user_id`. When Postgres receives the call before the JWT/session header is fully attached on a fresh login, `auth.uid()` returns NULL → function returns `'student'`. This is exactly what happens for newly-signed-in teachers on their first page load.

**B. Stale localStorage cache wins the race.** `useAuth.tsx` hydrates `resolvedRole` from `localStorage` instantly, then `Index.tsx` immediately renders the dashboard for that cached role. If she ever previously loaded the app before her teacher row was linked, she got cached as `'student'` and that wrong role is shown until the RPC eventually overwrites it (which often doesn't happen because of bug A).

**C. Fallback to `profile.role` is wrong.** When the RPC fails or returns falsy, useAuth falls back to `profile.role` — which for Tanushri is `'super_admin'` (a stale/manual value). Since super_admin isn't a case in `Index.tsx`'s switch, this would also break her dashboard.

### Bug 2: "Start Class" → "Join Session" transition not always working
This is tied to Bug 1 — when she lands as student, she never sees the teacher's Start Class button at all. Once role resolves correctly, this works.

---

## Fix Plan

### Step 1 — Fix the RPC (database migration)
Rewrite `public.get_user_role_from_tables(check_user_id uuid)` to:
- Actually use the `check_user_id` parameter (fall back to `auth.uid()` only if not provided).
- Return `NULL` instead of `'student'` when no user id is available, so the client can distinguish "unknown" from "confirmed student".

### Step 2 — Harden `useAuth.tsx`
- **Don't trust cached role for routing.** Keep cache for instant UI hints, but only set `resolvedRole` after the live RPC call confirms it (or after a clear timeout fallback). If RPC returns NULL/timeout, retry once before falling back.
- **Always pass `currentUser.id` to the RPC** (already done in code, but now the RPC will actually honor it).
- **Stop falling back to `profile.role`** for stale values like `super_admin`. Instead, on RPC failure, do a direct check against `admins`/`managers`/`teachers` tables by user_id as a backup, and only then default to `student`.
- **Invalidate cached role on every fresh sign-in event** (`SIGNED_IN`) so a previously-miscached role can't poison the new session.

### Step 3 — Harden `Index.tsx`
- While `resolvedRole` is still null/unconfirmed after `loading=false`, show a brief role-resolving spinner instead of defaulting to a wrong dashboard.
- Treat `super_admin` profile.role as `admin` for routing (so legacy super_admin entries don't render Access Denied).

### Step 4 — Data cleanup (one-time migration)
Reset `profiles.role` to match the role tables for the 5 users whose `profiles.role` is admin/manager/teacher/super_admin but who have NO matching row in those tables. Tanushri's profile row will be set to `'teacher'` since she's in the teachers table.

### Step 5 — Verification
After deploy, ask Tanushri to hard-reload (clears stale localStorage). Confirm she lands on `/teacher-schedule` and the `Start Class` → `Join Session` flow opens Jitsi as moderator.

---

## Files Touched
- `supabase/migrations/<new>.sql` — rewrite RPC + clean up stale `profiles.role` values
- `src/hooks/useAuth.tsx` — race-condition fix, role-resolution hardening
- `src/pages/Index.tsx` — role-resolving guard + super_admin alias

No changes needed to `TeacherJoinClass.tsx` — once role resolves correctly, the existing Start/Join flow works as designed.

