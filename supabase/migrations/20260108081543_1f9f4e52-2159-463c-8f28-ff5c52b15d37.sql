
-- Table to store verified users who can access during maintenance
CREATE TABLE public.verified_maintenance_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store maintenance mode settings
CREATE TABLE public.maintenance_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT DEFAULT 'We are currently performing scheduled maintenance. Please check back soon.',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.verified_maintenance_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for verified_maintenance_users
CREATE POLICY "Admins can manage verified users"
ON public.verified_maintenance_users
FOR ALL
USING (is_admin());

CREATE POLICY "Anyone can check if they are verified"
ON public.verified_maintenance_users
FOR SELECT
USING (true);

-- RLS Policies for maintenance_settings
CREATE POLICY "Admins can manage maintenance settings"
ON public.maintenance_settings
FOR ALL
USING (is_admin());

CREATE POLICY "Anyone can read maintenance status"
ON public.maintenance_settings
FOR SELECT
USING (true);

-- Insert default maintenance settings row
INSERT INTO public.maintenance_settings (is_maintenance_mode, maintenance_message)
VALUES (false, 'We are currently performing scheduled maintenance. Please check back soon.');
