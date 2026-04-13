
-- Function to delete chat_uploads files older than 7 days (per file creation date)
CREATE OR REPLACE FUNCTION public.delete_old_chat_uploads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
BEGIN
  -- Delete storage objects in chat_uploads bucket older than 7 days
  DELETE FROM storage.objects
  WHERE bucket_id = 'chat_uploads'
    AND created_at < (now() - INTERVAL '7 days');
    
  -- Also clear image_url references in community_messages for deleted images
  UPDATE public.community_messages
  SET image_url = NULL
  WHERE image_url IS NOT NULL
    AND created_at < (now() - INTERVAL '7 days');
END;
$$;
