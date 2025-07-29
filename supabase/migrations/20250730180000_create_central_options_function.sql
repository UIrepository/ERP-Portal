CREATE OR REPLACE FUNCTION get_all_options()
RETURNS TABLE(type TEXT, name TEXT) AS $$
BEGIN
    RETURN QUERY
    -- First, get all the officially created options
    SELECT a.type, a.name FROM public.available_options AS a
    UNION
    -- Then, find any batch names that might exist in profiles but not in the options table
    SELECT 'batch' AS type, unnest(p.batch) AS name FROM public.profiles AS p
    UNION
    -- Finally, find any subject names that might exist in profiles but not in the options table
    SELECT 'subject' AS type, unnest(p.subjects) AS name FROM public.profiles AS p;
END;
$$ LANGUAGE plpgsql STABLE;
