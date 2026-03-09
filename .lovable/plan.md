

# Critical Security Fix: Overly Permissive RLS Policies

## The Problem

A student was able to dump the entire `profiles` table (including super_admin accounts, bank details, emails) and the `teachers` table. The root cause: four tables have **wide-open SELECT policies** that let any authenticated user read everything.

### Vulnerable Policies

| Table | Policy | Issue |
|-------|--------|-------|
| `profiles` | "Authenticated users can view profiles" `USING (true)` | Exposes ALL profiles: bank_details, roles, emails, super_admin accounts |
| `teachers` | "Authenticated users can view teachers" `USING (true)` | Exposes all teacher emails and assignments |
| `admins` | "Authenticated users can view admins" `USING (true)` | Exposes admin emails |
| `managers` | "Authenticated users can view managers" `USING (true)` | Exposes manager emails |

## Fix Plan

### Step 1: Drop the dangerous open SELECT policies

Remove these four policies:
- `profiles`: "Authenticated users can view profiles"
- `teachers`: "Authenticated users can view teachers"
- `admins`: "Authenticated users can view admins"
- `managers`: "Authenticated users can view managers"

### Step 2: Add properly scoped replacement policies

**Profiles table** — Replace open access with targeted policies:
- **Students see only their own profile** (already exists via "Authenticated users can select their own profile")
- **Staff (admins/managers/teachers) can view all profiles** — needed for admin dashboards, staff inbox, directories
- No change needed for the self-select policy already in place

**Teachers table** — Replace open access:
- **Staff can view all teachers** — admin/manager dashboards need this
- **Students can view teacher name and user_id for their enrolled subjects** — needed for StudentChatbot/StudentChatTeacher. This will be a security definer function to avoid exposing email.

**Admins table:**
- **Only admins can view admins** (the "Admins can manage all admins" ALL policy already covers this)
- No student needs to see the admins table

**Managers table:**
- **Only admins and managers can view managers**
- Students use the chatbot to find managers, but the chatbot queries managers directly — we'll add a security definer function for that

### Step 3: Create a security definer function for student-facing teacher lookup

Students need to find their teacher's `user_id` and `name` for chat. Instead of giving them SELECT on the teachers table, create:

```sql
CREATE OR REPLACE FUNCTION public.get_teacher_for_subject(p_batch text, p_subject text)
RETURNS TABLE(user_id uuid, name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.user_id, t.name
  FROM public.teachers t
  WHERE p_batch = ANY(t.assigned_batches)
    AND p_subject = ANY(t.assigned_subjects)
    AND t.user_id IS NOT NULL
  LIMIT 1;
END;
$$;
```

### Step 4: Create a security definer function for student-facing manager lookup

Similarly for manager lookup in StudentChatbot:

```sql
CREATE OR REPLACE FUNCTION public.get_manager_for_batch(p_batch text)
RETURNS TABLE(user_id uuid, name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT m.user_id, m.name
  FROM public.managers m
  WHERE p_batch = ANY(m.assigned_batches)
    AND m.user_id IS NOT NULL;
END;
$$;
```

### Step 5: Update frontend code

Update `StudentChatbot.tsx` to use the new RPC functions instead of direct table queries for teacher/manager lookups. Other admin/teacher components will continue working because staff policies grant them access.

### Step 6: Profile name lookups for chat

`StaffInbox.tsx` and `NotificationCenter.tsx` look up profile names by user_id. These are staff-only components (behind role-gated dashboards), so the staff SELECT policy on profiles covers them.

## Summary of Changes

| What | Action |
|------|--------|
| Migration | Drop 4 open policies, add 4 scoped policies, create 2 RPC functions |
| `src/components/student/StudentChatbot.tsx` | Use `get_teacher_for_subject()` and `get_manager_for_batch()` RPCs |

