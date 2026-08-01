-- Egress: REPLICA IDENTITY FULL made every realtime UPDATE/DELETE ship the
-- complete OLD row alongside the new one to every subscriber — doubling
-- postgres_changes payloads app-wide. No client reads payload.old beyond the
-- primary key (verified 2026-08-02), so revert to DEFAULT (PK only).
-- Applied directly via the Management API on 2026-08-02; kept here so the
-- migration history matches the live database.

ALTER TABLE public.user_enrollments REPLICA IDENTITY DEFAULT;
ALTER TABLE public.schedules REPLICA IDENTITY DEFAULT;
ALTER TABLE public.meeting_links REPLICA IDENTITY DEFAULT;
ALTER TABLE public.dpp_content REPLICA IDENTITY DEFAULT;
ALTER TABLE public.notes REPLICA IDENTITY DEFAULT;
ALTER TABLE public.recordings REPLICA IDENTITY DEFAULT;
ALTER TABLE public.feedback REPLICA IDENTITY DEFAULT;
ALTER TABLE public.student_activities REPLICA IDENTITY DEFAULT;
ALTER TABLE public.profiles REPLICA IDENTITY DEFAULT;
