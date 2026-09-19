-- content_catalog — the ONLY thing the public internet is ever allowed to see
-- about batch content.
--
-- It is a derived projection of recordings / notes / dpp_content, kept in sync
-- by triggers (next migration). It exists so the main website can render a full
-- "what's inside this batch" view WITHOUT us ever relaxing the row-level
-- security on the real content tables.
--
-- THE RULE: this table must never gain a column that holds a playable or
-- downloadable address. Not embed_link, not file_url, not link, not stream_key.
-- That is enforced three ways:
--   1. the sync triggers simply never read those columns;
--   2. the public edge function selects an explicit column allowlist;
--   3. assert_catalog_has_no_urls() below fails loudly if anyone adds one.

create table if not exists public.content_catalog (
  id               uuid primary key default gen_random_uuid(),
  source_table     text not null check (source_table in ('recordings', 'notes', 'dpp_content')),
  source_id        uuid not null,
  batch            text not null,
  subject          text not null,
  content_type     text not null check (content_type in ('video', 'note', 'dpp')),
  title            text not null,
  topic            text,
  content_date     date,
  is_free_preview  boolean not null default false,
  sort_key         timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (source_table, source_id)
);

comment on table public.content_catalog is
  'Public, URL-free projection of batch content. Served to unknowniitians.com by the public-catalog edge function. Never add a URL column here.';

create index if not exists content_catalog_batch_idx         on public.content_catalog (batch, subject, sort_key desc);
create index if not exists content_catalog_batch_type_idx    on public.content_catalog (batch, content_type);
create index if not exists content_catalog_free_idx          on public.content_catalog (batch) where is_free_preview;

-- Locked down by default. There is no anon or authenticated policy on purpose:
-- the catalog reaches the public only through the public-catalog edge function,
-- which uses the service role and an explicit column list. Keeping the table
-- itself unreadable means a future column mistake cannot leak by itself.
alter table public.content_catalog enable row level security;

drop policy if exists "Admins can read the catalog" on public.content_catalog;
create policy "Admins can read the catalog"
  on public.content_catalog
  for select
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Tripwire. Returns the offending column names; empty array means we are clean.
-- Called by the daily cron below and by the repo's CI check.
create or replace function public.assert_catalog_has_no_urls()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  offenders text[];
begin
  select coalesce(array_agg(column_name order by column_name), '{}')
    into offenders
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'content_catalog'
    and (
      column_name ilike '%url%'
      or column_name ilike '%link%'
      or column_name ilike '%embed%'
      or column_name ilike '%stream%key%'
      or column_name ilike '%file%'
    );

  if array_length(offenders, 1) > 0 then
    raise exception
      'content_catalog must stay URL-free, but found: %. The catalog is public — move this column somewhere private.',
      array_to_string(offenders, ', ');
  end if;

  return offenders;
end;
$$;

comment on function public.assert_catalog_has_no_urls() is
  'Raises if content_catalog ever gains a URL-shaped column. Runs daily via pg_cron and in CI.';

select cron.schedule(
  'assert-catalog-url-free',
  '17 2 * * *',
  $$select public.assert_catalog_has_no_urls()$$
);
