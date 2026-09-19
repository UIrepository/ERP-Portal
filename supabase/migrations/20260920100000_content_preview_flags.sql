-- Free-preview flags: let an admin decide, per item, what the PUBLIC website may
-- play before the student has paid.
--
-- The flag lives on the source row (not on the derived catalog) on purpose: the
-- catalog is regenerated from these tables, so a flag stored there would be lost
-- on every rebuild. One row = one truth, and the catalog copies it.
--
-- Default is FALSE everywhere. Nothing becomes free without an admin action.

alter table public.recordings   add column if not exists is_free_preview boolean not null default false;
alter table public.notes        add column if not exists is_free_preview boolean not null default false;
alter table public.dpp_content  add column if not exists is_free_preview boolean not null default false;

comment on column public.recordings.is_free_preview  is 'Admin-set: this lecture plays on the main website without purchase.';
comment on column public.notes.is_free_preview       is 'Admin-set: this note downloads on the main website without purchase.';
comment on column public.dpp_content.is_free_preview is 'Admin-set: this DPP opens on the main website without purchase.';

-- Partial indexes — the resolver and the admin screen only ever ask "which ones
-- are free", never "which are not", so indexing the false majority is wasted.
create index if not exists recordings_free_preview_idx  on public.recordings  (batch, subject) where is_free_preview;
create index if not exists notes_free_preview_idx       on public.notes       (batch, subject) where is_free_preview;
create index if not exists dpp_content_free_preview_idx on public.dpp_content (batch, subject) where is_free_preview;

-- Per-batch master switch for the whole public preview.
-- Absent row = enabled, so a newly created batch is catalogued automatically and
-- nobody has to remember to opt it in. Admins opt a batch OUT.
create table if not exists public.content_preview_settings (
  batch               text primary key,
  is_preview_enabled  boolean not null default true,
  updated_by          uuid references auth.users (id) on delete set null,
  updated_at          timestamptz not null default now()
);

comment on table public.content_preview_settings is
  'Per-batch master switch for the public course catalog on unknowniitians.com. No row = preview enabled.';

alter table public.content_preview_settings enable row level security;

drop policy if exists "Admins manage preview settings" on public.content_preview_settings;
create policy "Admins manage preview settings"
  on public.content_preview_settings
  for all
  using  (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));
