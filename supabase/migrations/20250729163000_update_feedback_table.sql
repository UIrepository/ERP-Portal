ALTER TABLE public.feedback
DROP COLUMN feedback_text,
ADD COLUMN teacher_quality INT NOT NULL CHECK (teacher_quality >= 1 AND teacher_quality <= 5),
ADD COLUMN concept_clarity INT NOT NULL CHECK (concept_clarity >= 1 AND concept_clarity <= 5),
ADD COLUMN dpp_quality INT NOT NULL CHECK (dpp_quality >= 1 AND dpp_quality <= 5),
ADD COLUMN premium_content_usefulness INT NOT NULL CHECK (premium_content_usefulness >= 1 AND premium_content_usefulness <= 5),
ADD COLUMN comments TEXT NOT NULL;

-- Add a unique constraint to ensure one feedback per user, batch, and subject
ALTER TABLE public.feedback
ADD CONSTRAINT unique_feedback_per_user_batch_subject UNIQUE (submitted_by, batch, subject);
