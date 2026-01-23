-- Create class_attendance table for tracking who joins classes
CREATE TABLE public.class_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT,
  user_role TEXT CHECK (user_role IN ('student', 'teacher', 'manager', 'admin')),
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  batch TEXT NOT NULL,
  subject TEXT NOT NULL,
  class_date DATE NOT NULL DEFAULT CURRENT_DATE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, schedule_id, class_date)
);

-- Enable RLS
ALTER TABLE class_attendance ENABLE ROW LEVEL SECURITY;

-- Users can insert their own attendance
CREATE POLICY "Users can record own attendance"
ON class_attendance FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own attendance (for leave time)
CREATE POLICY "Users can update own attendance"
ON class_attendance FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Staff can view attendance based on their access
CREATE POLICY "Staff can view attendance"
ON class_attendance FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM teachers t WHERE t.user_id = auth.uid() AND class_attendance.batch = ANY(t.assigned_batches)) OR
  EXISTS (SELECT 1 FROM managers m WHERE m.user_id = auth.uid() AND class_attendance.batch = ANY(m.assigned_batches))
);