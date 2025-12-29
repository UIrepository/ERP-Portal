-- =============================================
-- Phase 1: Create Role Tables for Staff Members
-- =============================================

-- Create admins table (for system administrators)
CREATE TABLE public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create managers table (batch managers)
CREATE TABLE public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  assigned_batches TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create teachers table
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  assigned_batches TEXT[] DEFAULT '{}',
  assigned_subjects TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all role tables
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Phase 2: Create Schedule Requests Table
-- =============================================

-- Create enum for schedule request status
CREATE TYPE public.schedule_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create schedule_requests table
CREATE TABLE public.schedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  batch TEXT NOT NULL,
  subject TEXT NOT NULL,
  new_date DATE NOT NULL,
  new_start_time TIME NOT NULL,
  new_end_time TIME NOT NULL,
  reason TEXT,
  status schedule_request_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.schedule_requests ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Phase 3: Create Direct Messages Table
-- =============================================

CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  receiver_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Phase 4: Create Security Definer Functions
-- =============================================

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = check_user_id
  );
$$;

-- Function to check if a user is a manager
CREATE OR REPLACE FUNCTION public.is_manager(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.managers 
    WHERE user_id = check_user_id
  );
$$;

-- Function to check if a user is a teacher
CREATE OR REPLACE FUNCTION public.is_teacher(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers 
    WHERE user_id = check_user_id
  );
$$;

-- Function to get user role from tables (priority: admin > manager > teacher > student)
CREATE OR REPLACE FUNCTION public.get_user_role_from_tables(check_user_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admins WHERE user_id = check_user_id) THEN
    RETURN 'admin';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.managers WHERE user_id = check_user_id) THEN
    RETURN 'manager';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.teachers WHERE user_id = check_user_id) THEN
    RETURN 'teacher';
  END IF;
  
  RETURN 'student';
END;
$$;

-- Function to get manager's assigned batches
CREATE OR REPLACE FUNCTION public.get_manager_batches(check_user_id UUID DEFAULT auth.uid())
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(assigned_batches, '{}') FROM public.managers WHERE user_id = check_user_id;
$$;

-- Function to get teacher's assigned batches
CREATE OR REPLACE FUNCTION public.get_teacher_batches(check_user_id UUID DEFAULT auth.uid())
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(assigned_batches, '{}') FROM public.teachers WHERE user_id = check_user_id;
$$;

-- Function to get teacher's assigned subjects
CREATE OR REPLACE FUNCTION public.get_teacher_subjects(check_user_id UUID DEFAULT auth.uid())
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(assigned_subjects, '{}') FROM public.teachers WHERE user_id = check_user_id;
$$;

-- =============================================
-- Phase 5: RLS Policies for Role Tables
-- =============================================

-- Admins table policies
CREATE POLICY "Admins can view all admins" ON public.admins
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Only super admin can manage admins" ON public.admins
  FOR ALL USING (public.is_admin());

-- Managers table policies  
CREATE POLICY "Admins can manage all managers" ON public.managers
  FOR ALL USING (public.is_admin());

CREATE POLICY "Managers can view their own record" ON public.managers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can view managers for their batch" ON public.managers
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- Teachers table policies
CREATE POLICY "Admins can manage all teachers" ON public.teachers
  FOR ALL USING (public.is_admin());

CREATE POLICY "Managers can view teachers in their batches" ON public.teachers
  FOR SELECT USING (
    public.is_manager() AND 
    assigned_batches && public.get_manager_batches()
  );

CREATE POLICY "Teachers can view their own record" ON public.teachers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can view teachers" ON public.teachers
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- =============================================
-- Phase 6: RLS Policies for Schedule Requests
-- =============================================

CREATE POLICY "Teachers can create their own schedule requests" ON public.schedule_requests
  FOR INSERT WITH CHECK (
    public.is_teacher() AND
    requested_by IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "Teachers can view their own requests" ON public.schedule_requests
  FOR SELECT USING (
    requested_by IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers can view requests for their batches" ON public.schedule_requests
  FOR SELECT USING (
    public.is_manager() AND
    batch = ANY(public.get_manager_batches())
  );

CREATE POLICY "Managers can update requests for their batches" ON public.schedule_requests
  FOR UPDATE USING (
    public.is_manager() AND
    batch = ANY(public.get_manager_batches())
  );

CREATE POLICY "Admins can manage all schedule requests" ON public.schedule_requests
  FOR ALL USING (public.is_admin());

-- =============================================
-- Phase 7: RLS Policies for Direct Messages
-- =============================================

CREATE POLICY "Users can view their own messages" ON public.direct_messages
  FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

CREATE POLICY "Users can send messages" ON public.direct_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
  );

CREATE POLICY "Users can update their own sent messages" ON public.direct_messages
  FOR UPDATE USING (
    sender_id = auth.uid()
  );

CREATE POLICY "Receivers can mark messages as read" ON public.direct_messages
  FOR UPDATE USING (
    receiver_id = auth.uid()
  );

-- =============================================
-- Phase 8: Create indexes for performance
-- =============================================

CREATE INDEX idx_admins_user_id ON public.admins(user_id);
CREATE INDEX idx_admins_email ON public.admins(email);
CREATE INDEX idx_managers_user_id ON public.managers(user_id);
CREATE INDEX idx_managers_email ON public.managers(email);
CREATE INDEX idx_teachers_user_id ON public.teachers(user_id);
CREATE INDEX idx_teachers_email ON public.teachers(email);
CREATE INDEX idx_schedule_requests_status ON public.schedule_requests(status);
CREATE INDEX idx_schedule_requests_batch ON public.schedule_requests(batch);
CREATE INDEX idx_direct_messages_sender ON public.direct_messages(sender_id);
CREATE INDEX idx_direct_messages_receiver ON public.direct_messages(receiver_id);
CREATE INDEX idx_direct_messages_created_at ON public.direct_messages(created_at DESC);