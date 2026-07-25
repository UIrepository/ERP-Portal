/**
 * GET /api/schedules?batch=<batch name>
 *
 * Egress offload: the class timetable for a batch is IDENTICAL for every student
 * in that batch, yet each of them was fetching it straight from Supabase on every
 * schedule view. This edge-cached endpoint fetches it from Supabase at most once
 * per `s-maxage` window per batch; Vercel's CDN then serves every other student
 * from cache, so those repeat bytes leave Vercel instead of Supabase.
 *
 * SECURITY: a CDN-cached response is effectively public (on a cache hit the
 * function never runs, so it cannot auth-check). We therefore expose ONLY the
 * non-sensitive timetable columns and deliberately OMIT `link` / `stream_key` /
 * `broadcast_id`. Anyone who knows a batch name learns *when* it meets — not how
 * to join. The service-role key is read server-side only and never shipped to the
 * client; every query is pinned to a single `batch` so it can't dump other data.
 */

const SAFE_COLUMNS = 'id,day_of_week,start_time,end_time,subject,batch,date';

export default async function handler(req: any, res: any) {
  const batch = (req.query?.batch ?? '').toString().trim();
  if (!batch) {
    res.status(400).json({ error: 'batch query param is required' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'server not configured' });
    return;
  }

  const target =
    `${url}/rest/v1/schedules` +
    `?batch=eq.${encodeURIComponent(batch)}` +
    `&select=${SAFE_COLUMNS}`;

  try {
    const upstream = await fetch(target, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!upstream.ok) {
      res.status(502).json({ error: 'upstream error', status: upstream.status });
      return;
    }
    const rows = await upstream.json();

    // Browser revalidates quickly; the CDN holds the shared copy for 2 min and
    // may serve it stale for up to 10 min more while it refreshes in the
    // background — schedules change rarely, so this is invisible in practice.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=120, stale-while-revalidate=600');
    res.status(200).json(rows);
  } catch (err: any) {
    res.status(502).json({ error: 'fetch failed', detail: String(err?.message || err) });
  }
}
