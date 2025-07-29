CREATE TABLE public.available_options (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL, -- 'batch' or 'subject'
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.available_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to super admins" ON public.available_options
AS PERMISSIVE FOR ALL
TO authenticated
USING (get_current_user_role() = 'super_admin')
WITH CHECK (get_current_user_role() = 'super_admin');

-- Optional: Pre-populate with some initial values if you want
INSERT INTO public.available_options (type, name) VALUES
('batch', '2024-A'),
('batch', '2024-B'),
('subject', 'Physics'),
('subject', 'Chemistry');
