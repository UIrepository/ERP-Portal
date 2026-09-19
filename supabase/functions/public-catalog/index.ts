/**
 * GET /public-catalog?batch=<batch name>
 *
 * The public "what's inside this batch" feed that unknowniitians.com renders in
 * a course's Explore section — subjects, chapters, lecture and note titles,
 * counts, and which items the admin has marked as free.
 *
 * This endpoint is intentionally anonymous: the catalog is identical for every
 * visitor, so it is cached hard at the edge and costs Supabase one read per
 * revalidation window rather than one per visitor.
 *
 * SECURITY — the two rules that make an anonymous endpoint safe here:
 *
 *   1. It reads content_catalog, never the content tables. content_catalog has
 *      no column holding a playable or downloadable address (enforced by
 *      assert_catalog_has_no_urls()), so there is nothing here to leak.
 *   2. SELECT_COLUMNS below is an explicit allowlist. Even if someone later
 *      adds a column to content_catalog, it cannot reach this response without
 *      a deliberate edit here.
 *
 * The only identifier handed out is the opaque catalog row id. Turning that id
 * into something playable requires resolve-content, which checks payment.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://www.unknowniitians.com',
  'https://unknowniitians.com',
  'https://ssp.unknowniitians.com',
  'http://localhost:8080',
  'http://localhost:5173',
];

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}

/** Explicit allowlist. Adding a column to content_catalog must not widen this. */
const SELECT_COLUMNS = 'id, subject, content_type, title, topic, content_date, is_free_preview, sort_key';

/** Generous enough for the biggest batch (~420 items today), bounded all the same. */
const MAX_ITEMS = 2000;

type CatalogRow = {
  id: string;
  subject: string;
  content_type: 'video' | 'note' | 'dpp' | 'uikp';
  title: string;
  topic: string | null;
  content_date: string | null;
  sort_key: string;
  is_free_preview: boolean;
};

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'));
  const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', ...extra },
    });

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    const batch = new URL(req.url).searchParams.get('batch')?.trim();
    if (!batch) return json({ error: 'Missing batch' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // A batch an admin has switched off returns an empty catalog rather than a
    // 404 — the website still renders the course page, just without Explore.
    const { data: settings } = await supabase
      .from('content_preview_settings')
      .select('is_preview_enabled')
      .eq('batch', batch)
      .maybeSingle();

    // No row means "not configured", which we treat as enabled so a brand new
    // batch shows up without anyone having to remember to opt it in.
    if (settings && settings.is_preview_enabled === false) {
      return json(
        { batch, preview_enabled: false, subjects: [], totals: { video: 0, note: 0, dpp: 0, uikp: 0, free: 0 } },
        200,
        { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
      );
    }

    const { data, error } = await supabase
      .from('content_catalog')
      .select(SELECT_COLUMNS)
      .eq('batch', batch)
      .order('subject', { ascending: true })
      .order('sort_key', { ascending: false })
      // Deterministic tiebreaker. Whole batches of notes and DPPs are inserted
      // in one transaction and share an identical created_at, so sort_key alone
      // left their order undefined — the same request could return a different
      // first row each time, which made "the top item of this subject" a
      // meaningless thing to point at.
      .order('id', { ascending: true })
      .limit(MAX_ITEMS);

    if (error) {
      console.error('catalog read failed', error);
      return json({ error: 'Catalog unavailable' }, 500);
    }

    const rows = (data ?? []) as CatalogRow[];

    // Group into subjects, and within a subject into chapters (a recording's
    // topic). Both come from the data — nothing about subjects or chapters is
    // listed anywhere in code.
    const bySubject = new Map<string, CatalogRow[]>();
    for (const row of rows) {
      const list = bySubject.get(row.subject);
      if (list) list.push(row);
      else bySubject.set(row.subject, [row]);
    }

    const subjects = [...bySubject.entries()].map(([subject, items]) => ({
      subject,
      counts: {
        video: items.filter((i) => i.content_type === 'video').length,
        note:  items.filter((i) => i.content_type === 'note').length,
        dpp:   items.filter((i) => i.content_type === 'dpp').length,
        uikp:  items.filter((i) => i.content_type === 'uikp').length,
        free:  items.filter((i) => i.is_free_preview).length,
      },
      items: items.map((i) => ({
        id: i.id,
        type: i.content_type,
        title: i.title,
        topic: i.topic,
        date: i.content_date,
        free: i.is_free_preview,
      })),
    }));

    const totals = subjects.reduce(
      (acc, s) => ({
        video: acc.video + s.counts.video,
        note:  acc.note  + s.counts.note,
        dpp:   acc.dpp   + s.counts.dpp,
        uikp:  acc.uikp  + s.counts.uikp,
        free:  acc.free  + s.counts.free,
      }),
      { video: 0, note: 0, dpp: 0, uikp: 0, free: 0 },
    );

    return json(
      { batch, preview_enabled: true, subjects, totals },
      200,
      { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
    );
  } catch (err) {
    console.error('public-catalog error', err);
    return json({ error: 'Catalog unavailable' }, 500);
  }
});
