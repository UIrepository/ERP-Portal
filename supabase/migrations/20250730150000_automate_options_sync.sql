-- This function will scan the profiles table and add any new batch/subject names to the available_options table.
CREATE OR REPLACE FUNCTION public.sync_available_options()
RETURNS TRIGGER AS $$
DECLARE
    batch_name TEXT;
    subject_name TEXT;
BEGIN
    -- For Batches
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.batch IS DISTINCT FROM OLD.batch) THEN
        IF NEW.batch IS NOT NULL THEN
            FOREACH batch_name IN ARRAY NEW.batch
            LOOP
                INSERT INTO public.available_options (type, name)
                VALUES ('batch', batch_name)
                ON CONFLICT (type, name) DO NOTHING;
            END LOOP;
        END IF;
    END IF;

    -- For Subjects
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.subjects IS DISTINCT FROM OLD.subjects) THEN
        IF NEW.subjects IS NOT NULL THEN
            FOREACH subject_name IN ARRAY NEW.subjects
            LOOP
                INSERT INTO public.available_options (type, name)
                VALUES ('subject', subject_name)
                ON CONFLICT (type, name) DO NOTHING;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- This trigger will automatically run the function whenever a profile is created or updated.
DROP TRIGGER IF EXISTS on_profile_change_sync_options ON public.profiles;
CREATE TRIGGER on_profile_change_sync_options
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_available_options();
