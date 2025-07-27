-- Create enum types for roles and subjects
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'super_admin');
CREATE TYPE exam_type AS ENUM ('mock', 'final', 'practice');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  batch TEXT,
  subjects TEXT[], -- Array of subjects
  exams TEXT[], -- Array of exams
  role user_role NOT NULL DEFAULT 'student',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create schedules table
CREATE TABLE public.schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject TEXT NOT NULL,
  batch TEXT NOT NULL,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recordings table
CREATE TABLE public.recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  embed_link TEXT NOT NULL,
  batch TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  subject TEXT NOT NULL,
  batch TEXT NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feedback table
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  subject TEXT NOT NULL,
  batch TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create extra_classes table
CREATE TABLE public.extra_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject TEXT NOT NULL,
  batch TEXT NOT NULL,
  link TEXT,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exams table
CREATE TABLE public.exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  subject TEXT NOT NULL,
  type exam_type NOT NULL,
  batch TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_logs table
CREATE TABLE public.chat_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  batch TEXT NOT NULL,
  subject TEXT NOT NULL
);

-- Create notifications table for admin updates
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_role user_role,
  target_batch TEXT,
  target_subject TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to get current user batch
CREATE OR REPLACE FUNCTION public.get_current_user_batch()
RETURNS TEXT AS $$
  SELECT batch FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to get current user subjects
CREATE OR REPLACE FUNCTION public.get_current_user_subjects()
RETURNS TEXT[] AS $$
  SELECT subjects FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT USING (get_current_user_role() = 'super_admin');

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Super admins can update all profiles" ON public.profiles
  FOR UPDATE USING (get_current_user_role() = 'super_admin');

CREATE POLICY "Super admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (get_current_user_role() = 'super_admin');

-- RLS Policies for schedules
CREATE POLICY "Users can view schedules for their batch" ON public.schedules
  FOR SELECT USING (batch = get_current_user_batch());

CREATE POLICY "Teachers can view schedules for their subjects and batches" ON public.schedules
  FOR SELECT USING (
    get_current_user_role() = 'teacher' AND 
    subject = ANY(get_current_user_subjects()) AND
    batch = get_current_user_batch()
  );

CREATE POLICY "Super admins can view all schedules" ON public.schedules
  FOR SELECT USING (get_current_user_role() = 'super_admin');

CREATE POLICY "Super admins can manage schedules" ON public.schedules
  FOR ALL USING (get_current_user_role() = 'super_admin');

-- RLS Policies for recordings
CREATE POLICY "Students can view recordings for their batch and subjects" ON public.recordings
  FOR SELECT USING (
    batch = get_current_user_batch() AND 
    subject = ANY(get_current_user_subjects())
  );

CREATE POLICY "Teachers can view recordings for their subjects and batches" ON public.recordings
  FOR SELECT USING (
    get_current_user_role() = 'teacher' AND 
    subject = ANY(get_current_user_subjects()) AND
    batch = get_current_user_batch()
  );

CREATE POLICY "Super admins can manage recordings" ON public.recordings
  FOR ALL USING (get_current_user_role() = 'super_admin');

-- RLS Policies for notes
CREATE POLICY "Students can view notes for their batch and subjects" ON public.notes
  FOR SELECT USING (
    batch = get_current_user_batch() AND 
    subject = ANY(get_current_user_subjects())
  );

CREATE POLICY "Teachers can view notes for their subjects and batches" ON public.notes
  FOR SELECT USING (
    get_current_user_role() = 'teacher' AND 
    subject = ANY(get_current_user_subjects()) AND
    batch = get_current_user_batch()
  );

CREATE POLICY "Super admins can manage notes" ON public.notes
  FOR ALL USING (get_current_user_role() = 'super_admin');

-- RLS Policies for feedback
CREATE POLICY "Students can view and submit feedback for their batch and subjects" ON public.feedback
  FOR ALL USING (
    batch = get_current_user_batch() AND 
    subject = ANY(get_current_user_subjects())
  );

CREATE POLICY "Teachers can view feedback for their subjects and batches" ON public.feedback
  FOR SELECT USING (
    get_current_user_role() = 'teacher' AND 
    subject = ANY(get_current_user_subjects()) AND
    batch = get_current_user_batch()
  );

CREATE POLICY "Super admins can view all feedback" ON public.feedback
  FOR SELECT USING (get_current_user_role() = 'super_admin');

-- RLS Policies for extra_classes
CREATE POLICY "Users can view extra classes for their batch" ON public.extra_classes
  FOR SELECT USING (batch = get_current_user_batch());

CREATE POLICY "Teachers can manage extra classes for their subjects and batches" ON public.extra_classes
  FOR ALL USING (
    get_current_user_role() = 'teacher' AND 
    subject = ANY(get_current_user_subjects()) AND
    batch = get_current_user_batch()
  );

CREATE POLICY "Super admins can manage all extra classes" ON public.extra_classes
  FOR ALL USING (get_current_user_role() = 'super_admin');

-- RLS Policies for exams
CREATE POLICY "Students can view exams for their subjects" ON public.exams
  FOR SELECT USING (subject = ANY(get_current_user_subjects()));

CREATE POLICY "Teachers can view exams for their subjects" ON public.exams
  FOR SELECT USING (
    get_current_user_role() = 'teacher' AND 
    subject = ANY(get_current_user_subjects())
  );

CREATE POLICY "Super admins can manage exams" ON public.exams
  FOR ALL USING (get_current_user_role() = 'super_admin');

-- RLS Policies for notifications
CREATE POLICY "Users can view relevant notifications" ON public.notifications
  FOR SELECT USING (
    is_active = true AND (
      target_role IS NULL OR target_role = get_current_user_role()
    ) AND (
      target_batch IS NULL OR target_batch = get_current_user_batch()
    ) AND (
      target_subject IS NULL OR target_subject = ANY(get_current_user_subjects())
    )
  );

CREATE POLICY "Super admins can manage notifications" ON public.notifications
  FOR ALL USING (get_current_user_role() = 'super_admin');

-- RLS Policies for chat_logs (only super admins can view)
CREATE POLICY "Super admins can view all chat logs" ON public.chat_logs
  FOR SELECT USING (get_current_user_role() = 'super_admin');

CREATE POLICY "Super admins can insert chat logs" ON public.chat_logs
  FOR INSERT WITH CHECK (get_current_user_role() = 'super_admin');

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    CASE 
      WHEN NEW.email = 'uiwebsite638@gmail.com' THEN 'super_admin'::user_role
      ELSE 'student'::user_role
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_recordings_updated_at BEFORE UPDATE ON public.recordings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_extra_classes_updated_at BEFORE UPDATE ON public.extra_classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();