-- Add UI Ki Padhai to the catalog.
--
-- The main website now mirrors the portal's subject hub, which has a UI Ki
-- Padhai tile alongside Lectures, Notes and DPPs. Without this the tile would
-- always read "0 Premium Content", which is both wrong and the opposite of
-- what that tile is there to sell.
--
-- Same shape as the other three: URL-free projection, flag on the source row.

alter table public.ui_ki_padhai_content
  add column if not exists is_free_preview boolean not null default false;

comment on column public.ui_ki_padhai_content.is_free_preview is
  'Admin-set: this premium item opens on the main website without purchase.';

create index if not exists ui_ki_padhai_free_preview_idx
  on public.ui_ki_padhai_content (batch, subject) where is_free_preview;

alter table public.content_catalog drop constraint if exists content_catalog_source_table_check;
alter table public.content_catalog add constraint content_catalog_source_table_check
  check (source_table in ('recordings', 'notes', 'dpp_content', 'ui_ki_padhai_content'));

alter table public.content_catalog drop constraint if exists content_catalog_content_type_check;
alter table public.content_catalog add constraint content_catalog_content_type_check
  check (content_type in ('video', 'note', 'dpp', 'uikp'));

create or replace function public.sync_catalog_uikp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.content_catalog
     where source_table = 'ui_ki_padhai_content' and source_id = old.id;
    return old;
  end if;

  if new.batch is null or new.subject is null
     or coalesce(new.title, '') = '' or new.is_active is not true then
    delete from public.content_catalog
     where source_table = 'ui_ki_padhai_content' and source_id = new.id;
    return new;
  end if;

  insert into public.content_catalog
    (source_table, source_id, batch, subject, content_type, title, topic, content_date, is_free_preview, sort_key, updated_at)
  values
    ('ui_ki_padhai_content', new.id, new.batch, new.subject, 'uikp', new.title, new.category,
     new.created_at::date, new.is_free_preview, coalesce(new.created_at, now()), now())
  on conflict (source_table, source_id) do update set
    batch           = excluded.batch,
    subject         = excluded.subject,
    title           = excluded.title,
    topic           = excluded.topic,
    content_date    = excluded.content_date,
    is_free_preview = excluded.is_free_preview,
    sort_key        = excluded.sort_key,
    updated_at      = now();

  return new;
end;
$$;

drop trigger if exists sync_catalog_uikp_trg on public.ui_ki_padhai_content;
create trigger sync_catalog_uikp_trg
  after insert or update or delete on public.ui_ki_padhai_content
  for each row execute function public.sync_catalog_uikp();

insert into public.content_catalog
  (source_table, source_id, batch, subject, content_type, title, topic, content_date, is_free_preview, sort_key)
select 'ui_ki_padhai_content', u.id, u.batch, u.subject, 'uikp', u.title, u.category,
       u.created_at::date, u.is_free_preview, coalesce(u.created_at, now())
  from public.ui_ki_padhai_content u
 where u.batch is not null and u.subject is not null
   and coalesce(u.title, '') <> '' and u.is_active is true
on conflict (source_table, source_id) do nothing;
