
-- Create subject_merges table
CREATE TABLE public.subject_merges (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    primary_batch text NOT NULL,
    primary_subject text NOT NULL,
    secondary_batch text NOT NULL,
    secondary_subject text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subject_merges ENABLE ROW LEVEL SECURITY;

-- Admins get full CRUD
CREATE POLICY "Admins can manage subject merges"
ON public.subject_merges
FOR ALL
USING (is_admin());

-- Authenticated users can read (needed for merge-aware queries)
CREATE POLICY "Authenticated users can view active merges"
ON public.subject_merges
FOR SELECT
USING (auth.role() = 'authenticated'::text AND is_active = true);

-- Create the core lookup function
CREATE OR REPLACE FUNCTION public.get_merged_pairs(p_batch text, p_subject text)
RETURNS TABLE(batch text, subject text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN QUERY
    -- Return the original pair
    SELECT p_batch, p_subject
    UNION
    -- Return secondary side where input matches primary
    SELECT sm.secondary_batch, sm.secondary_subject
    FROM public.subject_merges sm
    WHERE sm.is_active = true
      AND sm.primary_batch = p_batch
      AND sm.primary_subject = p_subject
    UNION
    -- Return primary side where input matches secondary
    SELECT sm.primary_batch, sm.primary_subject
    FROM public.subject_merges sm
    WHERE sm.is_active = true
      AND sm.secondary_batch = p_batch
      AND sm.secondary_subject = p_subject;
END;
$$;
