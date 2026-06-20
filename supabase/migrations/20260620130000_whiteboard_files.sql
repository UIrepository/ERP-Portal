-- General-purpose teacher whiteboards ("workspace files"). Private to each
-- teacher; admins can VIEW all of them to monitor work. The drawing content
-- (tldraw snapshot) and thumbnail live in Cloudinary — only their URLs are
-- stored here, so this table stays tiny. Nothing here is tied to a batch or
-- subject, and exported PDFs are download-only on the device.
create table if not exists public.whiteboard_files (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  title               text not null default 'Untitled whiteboard',
  content_url         text,        -- Cloudinary raw URL of the tldraw snapshot (JSON)
  content_public_id   text,        -- Cloudinary public_id (for replace/delete)
  thumbnail_url       text,        -- Cloudinary image URL of the preview
  thumbnail_public_id text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists whiteboard_files_owner_idx on public.whiteboard_files (owner_id, updated_at desc);

alter table public.whiteboard_files enable row level security;

-- Helpers: is the caller a teacher / an admin?
-- (teachers + admins tables key on user_id, same pattern as the rest of the app.)

-- Owners who are staff (teacher or admin) fully manage their own files.
drop policy if exists "Staff manage own whiteboard files" on public.whiteboard_files;
create policy "Staff manage own whiteboard files"
  on public.whiteboard_files for all
  using (
    owner_id = auth.uid()
    and (
      exists (select 1 from public.teachers t where t.user_id = auth.uid())
      or exists (select 1 from public.admins a where a.user_id = auth.uid())
    )
  )
  with check (
    owner_id = auth.uid()
    and (
      exists (select 1 from public.teachers t where t.user_id = auth.uid())
      or exists (select 1 from public.admins a where a.user_id = auth.uid())
    )
  );

-- Admins can VIEW every teacher's whiteboard (monitor work) — read-only.
drop policy if exists "Admins view all whiteboard files" on public.whiteboard_files;
create policy "Admins view all whiteboard files"
  on public.whiteboard_files for select
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Keep updated_at fresh on every change.
create or replace function public.touch_whiteboard_files_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists trg_whiteboard_files_updated_at on public.whiteboard_files;
create trigger trg_whiteboard_files_updated_at
  before update on public.whiteboard_files
  for each row execute function public.touch_whiteboard_files_updated_at();
