-- DPPs can now sit in a topic, like lectures and notes.
--
-- Null means "Other" (not filed under any topic) — every existing DPP starts
-- there, so nothing changes for a subject until someone files its DPPs.
-- on delete set null: deleting a topic un-files its DPPs rather than deleting them.

alter table public.dpp_content
  add column if not exists bucket_id uuid references public.content_buckets (id) on delete set null;

comment on column public.dpp_content.bucket_id is 'Topic (content_buckets row) this DPP belongs to. Null = Other.';

create index if not exists dpp_content_bucket_idx on public.dpp_content (batch, subject, bucket_id);
