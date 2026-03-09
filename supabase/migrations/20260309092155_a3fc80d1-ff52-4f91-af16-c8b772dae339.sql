
-- Force PostgREST to reload its schema cache after our policy changes
NOTIFY pgrst, 'reload schema';
