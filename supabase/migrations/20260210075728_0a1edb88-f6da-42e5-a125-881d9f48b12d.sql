
-- Step 1: Drop redundant direct-email triggers
DROP TRIGGER IF EXISTS on_announcement_created ON public.notifications;
DROP TRIGGER IF EXISTS on_recording_created ON public.recordings;
DROP TRIGGER IF EXISTS on_notes_created ON public.notes;

-- Step 2: Add Google Group relay trigger for notes
CREATE TRIGGER on_notes_google_group
  AFTER INSERT ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_via_google_group();

-- Step 3: Drop orphaned function
DROP FUNCTION IF EXISTS public.handle_general_notifications() CASCADE;

-- Step 4: Drop now-unused direct-email function
DROP FUNCTION IF EXISTS public.handle_email_notification() CASCADE;
