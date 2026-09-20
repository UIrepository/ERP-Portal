/**
 * GET /api/recordings?batch=<batch>&subject=<subject>
 *
 * Egress offload: the recordings LIST for a batch+subject is identical for every
 * enrolled student, but each of them fetched it straight from Supabase. This
 * edge-cached endpoint fetches it once per s-maxage window; Vercel's CDN serves
 * the rest — moving repeat bytes off Supabase.
 *
 * SECURITY: a CDN-cached response is effectively public, so we return ONLY
 * non-sensitive list metadata and deliberately OMIT `embed_link` (the actual
 * video URL). The list UI doesn't use it — playback opens /lecture/:id, which
 * fetches the video URL by id under the student's own RLS. So the video links
 * stay private; only "a lecture exists on this date" is cacheable. Service-role
 * key is server-side only; every query is pinned to one batch+subject.
 */

// bucket_id is just a grouping key — it names no URL and reveals nothing
// beyond "these lectures belong to the same week", which the titles already
// imply. Safe to cache publicly alongside the rest.
const SAFE_COLUMNS = 'id,date,subject,topic,created_at,bucket_id';

export default async function handler(req: any, res: any) {
  const batch = (req.query?.batch ?? '').toString().trim();
  const subject = (req.query?.subject ?? '').toString().trim();
  if (!batch || !subject) {
    res.status(400).json({ error: 'batch and subject query params are required' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'server not configured' });
    return;
  }

  const target =
    `${url}/rest/v1/recordings` +
    `?batch=eq.${encodeURIComponent(batch)}` +
    `&subject=eq.${encodeURIComponent(subject)}` +
    `&select=${SAFE_COLUMNS}` +
    `&order=date.desc,created_at.desc`;

  try {
    const upstream = await fetch(target, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!upstream.ok) {
      res.status(502).json({ error: 'upstream error', status: upstream.status });
      return;
    }
    const rows = await upstream.json();
    // Recordings change rarely; hold at the CDN for 3 min, serve stale up to 15
    // more while it refreshes in the background.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=180, stale-while-revalidate=900');
    res.status(200).json(rows);
  } catch (err: any) {
    res.status(502).json({ error: 'fetch failed', detail: String(err?.message || err) });
  }
}
