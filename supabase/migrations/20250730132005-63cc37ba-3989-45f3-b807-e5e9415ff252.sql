
-- Add missing columns to student_activities table for proper activity logging
ALTER TABLE public.student_activities 
ADD COLUMN IF NOT EXISTS batch text,
ADD COLUMN IF NOT EXISTS subject text;

-- Enable real-time updates for all relevant tables
ALTER TABLE public.user_enrollments REPLICA IDENTITY FULL;
ALTER TABLE public.schedules REPLICA IDENTITY FULL;
ALTER TABLE public.meeting_links REPLICA IDENTITY FULL;
ALTER TABLE public.dpp_content REPLICA IDENTITY FULL;
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.recordings REPLICA IDENTITY FULL;
ALTER TABLE public.feedback REPLICA IDENTITY FULL;
ALTER TABLE public.student_activities REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_enrollments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dpp_content;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recordings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
