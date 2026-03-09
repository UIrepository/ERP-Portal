
-- Step 1: Drop the 4 dangerous wide-open SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view teachers" ON public.teachers;
DROP POLICY IF EXISTS "Authenticated users can view admins" ON public.admins;
DROP POLICY IF EXISTS "Authenticated users can view managers" ON public.managers;

-- Step 2: Add scoped replacement policies

-- Profiles: Staff (admins/managers/teachers) can view all profiles (needed for dashboards)
CREATE POLICY "Staff can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.managers WHERE managers.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.teachers WHERE teachers.user_id = auth.uid())
  );

-- Teachers: Staff can view all teachers
CREATE POLICY "Staff can view all teachers"
  ON public.teachers FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.managers WHERE managers.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.teachers WHERE teachers.user_id = auth.uid())
  );

-- Managers: Only admins and managers can view managers
CREATE POLICY "Staff can view all managers"
  ON public.managers FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.managers WHERE managers.user_id = auth.uid())
  );

-- Step 3: Create security definer function for student teacher lookup
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

-- Step 4: Create security definer function for student manager lookup
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

-- Step 5: Create security definer function for checking available staff (for chatbot welcome screen)
CREATE OR REPLACE FUNCTION public.get_available_support_staff(p_student_batches text[] DEFAULT '{}'::text[])
RETURNS TABLE(has_admin boolean, has_manager boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXISTS(SELECT 1 FROM public.admins WHERE admins.user_id IS NOT NULL) AS has_admin,
    EXISTS(SELECT 1 FROM public.managers WHERE managers.user_id IS NOT NULL) AS has_manager;
END;
$$;
