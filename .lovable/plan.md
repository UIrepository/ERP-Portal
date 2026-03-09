

# Full Security Audit: All Vulnerable Tables

## CRITICAL Findings

### 1. Privilege Escalation on `profiles` (CRITICAL)
The UPDATE policy "Users can update their own profile except role" checks only `auth.uid() = user_id` but does NOT restrict which columns can be changed. Any student can run:
```sql
UPDATE profiles SET role = 'super_admin' WHERE user_id = auth.uid();
```
This grants them full admin access to everything. There IS a trigger `prevent_role_change_by_non_admin` but it checks `current_setting('is_superuser.role')` which is unreliable.

**Fix:** Replace the UPDATE policy with one that uses a BEFORE UPDATE trigger that hard-blocks role/premium_access changes unless the caller is an admin.

### 2. `profile_basics` Table — No RLS at All
This table has `user_id`, `email`, `name` with zero RLS policies. If RLS is enabled, nobody can read it. If RLS is NOT enabled, everyone (even anonymous) can read all user data.

**Fix:** Either enable RLS + add proper policies, or drop the table if unused.

### 3. `active_classes` — Room URLs Exposed to Everyone
SELECT policy uses `USING (true)`, meaning any authenticated user sees all active class `room_url` values, even classes they're not enrolled in.

**Fix:** Restrict SELECT to enrolled students (via `user_enrollments`) + staff.

### 4. `doubts` and `doubt_answers` — All Users See Everything
Both tables have SELECT policies with `USING (auth.role() = 'authenticated')`. Any logged-in user can read ALL doubts and answers across all batches/subjects.

**Fix:** Scope SELECT to users enrolled in the doubt's batch+subject, plus staff.

### 5. `message_likes` — All Likes Visible to Everyone
SELECT `USING (true)` exposes all like data. Low-risk but unnecessary exposure.

**Fix:** Scope to users who can see the parent community message.

## MODERATE Findings

### 6. `meeting_links` — Active Links Visible to All
SELECT `USING (is_active = true)` lets any authenticated user see meeting join links for any batch/subject.

**Fix:** Scope to enrolled students + staff.

### 7. `schedules` — Overly Broad Student Access
Policy "Students can view all schedules" uses `profiles.role = 'student'` to let students see ALL schedules across ALL batches. There are also enrollment-scoped policies, creating redundancy where the broadest one wins.

**Fix:** Drop the overly broad policy. The enrollment-scoped policy already exists.

## Already Secure (No Changes Needed)
- `direct_messages` — Properly scoped: sender or receiver only
- `community_messages` — Properly scoped: enrollment-based + staff
- `payments` — Properly scoped: own payments + admins (service role policy is fine)
- `notes`, `recordings`, `dpp_content`, `feedback` — All properly enrollment-scoped

## Implementation Plan

### Migration SQL

**Step 1: Fix privilege escalation on profiles**
- Create a robust BEFORE UPDATE trigger that prevents non-admins from changing `role`, `premium_access`, or `bank_details`
- Keep the existing UPDATE policy but add the trigger as a safety net

**Step 2: Secure `profile_basics`**
- Enable RLS on `profile_basics`
- Add policy: users can only see their own row, staff can see all

**Step 3: Lock down `active_classes`**
- Drop the open SELECT policy
- Add enrollment-scoped SELECT for students, staff can see all

**Step 4: Lock down `doubts` and `doubt_answers`**
- Drop the open SELECT policies
- Add enrollment-scoped SELECT (match doubt's batch+subject to user_enrollments)
- Keep staff access

**Step 5: Lock down `meeting_links`**
- Drop the open active-links SELECT policy
- Add enrollment-scoped SELECT for students, staff can see all

**Step 6: Remove overly broad schedule policy**
- Drop "Students can view all schedules" (the enrollment-scoped policy already covers legitimate access)
- Drop "Students can view schedules for their batch" (same — too broad, no subject check)

**Step 7: Lock down `message_likes`**
- Replace open SELECT with enrollment-scoped check (likes on messages the user can see)

### Frontend Changes
None required — all queries already filter by batch/subject. The RLS changes only prevent malicious direct API access.

### Summary

| Table | Issue | Severity |
|-------|-------|----------|
| `profiles` | Users can change own role to super_admin | CRITICAL |
| `profile_basics` | No RLS at all | CRITICAL |
| `active_classes` | Room URLs exposed to all | HIGH |
| `doubts` | All doubts visible to everyone | HIGH |
| `doubt_answers` | All answers visible to everyone | HIGH |
| `meeting_links` | Join links exposed to all | MODERATE |
| `schedules` | Overly broad student access | MODERATE |
| `message_likes` | All likes visible | LOW |

