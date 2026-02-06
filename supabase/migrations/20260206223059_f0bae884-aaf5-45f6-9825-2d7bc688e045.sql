-- Add context column to distinguish message types
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS context TEXT DEFAULT 'general';

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_direct_messages_context 
ON public.direct_messages(context);

-- Add subject context for teacher chats
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS subject_context TEXT DEFAULT NULL;

-- Add index for subject context filtering
CREATE INDEX IF NOT EXISTS idx_direct_messages_subject_context 
ON public.direct_messages(subject_context);