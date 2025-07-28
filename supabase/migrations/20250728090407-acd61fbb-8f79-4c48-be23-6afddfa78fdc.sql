
-- Add bank_details column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bank_details jsonb;
