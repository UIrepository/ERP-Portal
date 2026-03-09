-- Add 'teacher' to user_role enum (fixes 500 on profiles table)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'teacher';

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';