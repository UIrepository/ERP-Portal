ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS broadcast_id text;

UPDATE schedules SET stream_key = NULL WHERE stream_key IS NOT NULL;