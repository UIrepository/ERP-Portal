/**
 * GET /api/shared?resource=<name>&... — consolidated Vercel-edge-cached reads.
 *
 * Egress offload (same idea as /api/schedules): these datasets are IDENTICAL for
 * every student (or every student in a batch), yet each client was fetching them
 * straight from Supabase on a poll. Serving them through Vercel's CDN means
 * Supabase pays for at most one fetch per s-maxage window per cache key — every
 * other request is served by Vercel.
 *
 * SECURITY: a CDN-cached response is effectively public (on a cache hit the
 * function never runs, so it cannot auth-check). Every resource here therefore
 * exposes ONLY non-sensitive columns:
 *   - `today`  — a batch's timetable for today + which subjects are live + the
 *                ids/titles of recordings uploaded today. Deliberately OMITS
 *                schedule `link`, active_classes `room_url` and recordings
 *                `embed_link` (the player fetches the single recording by id
 *                under RLS instead). Knowing a batch name reveals *when* it
 *                meets — never how to join or watch.
 *   - `flags`  — maintenance_settings + feedback_gate config. Both tables are
 *                world-readable under RLS already (`USING (true)`), so caching
 *                them publicly changes nothing.
 * The service-role key stays server-side; queries are pinned per resource with a
 * fixed column list so the endpoint can't be steered to dump anything else.
 */

const IST_OFFSET_MIN = 330;

type Res = {
  status: (code: number) => Res;
  setHeader: (k: string, v: string) => void;
  json: (body: unknown) => void;
};

export default async function handler(req: { query?: Record<string, unknown> }, res: Res) {
  const resource = (req.query?.resource ?? '').toString().trim();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'server not configured' });
    return;
  }

  const rest = async (path: string): Promise<unknown[]> => {
    const r = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) throw new Error(`upstream ${r.status} for ${path.split('?')[0]}`);
    return r.json();
  };

  try {
    if (resource === 'today') {
      const batch = (req.query?.batch ?? '').toString().trim();
      if (!batch || batch.length > 200) {
        res.status(400).json({ error: 'batch query param is required' });
        return;
      }
      // IST wall clock (fixed UTC+5:30), same arithmetic as the client, so
      // "today" never depends on the serverless region's timezone.
      const ist = new Date(Date.now() + IST_OFFSET_MIN * 60000);
      const today = ist.toISOString().slice(0, 10);
      const dow = ist.getUTCDay();
      const b = encodeURIComponent(batch);

      const [schedules, active, recordings] = await Promise.all([
        rest(
          `schedules?batch=eq.${b}&or=(day_of_week.eq.${dow},date.eq.${today})` +
            `&select=subject,start_time,end_time,date,day_of_week`,
        ),
        rest(`active_classes?batch=eq.${b}&is_active=eq.true&select=subject,started_at`),
        rest(
          `recordings?batch=eq.${b}&date=eq.${today}&select=id,subject,topic,date&order=created_at.desc`,
        ),
      ]);

      // One shared copy per batch per minute; stale-while-revalidate keeps it
      // instant while the CDN refreshes in the background. The strip's realtime
      // subscription still delivers "went live" instantly — this feed is the
      // slow backbone, not the live signal.
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=240');
      res.status(200).json({ today, dow, schedules, active, recordings });
      return;
    }

    if (resource === 'flags') {
      const [maintenance, gate] = await Promise.all([
        rest('maintenance_settings?select=is_maintenance_mode,maintenance_message&limit=1'),
        rest('feedback_gate?id=eq.1&select=enabled,scope&limit=1'),
      ]);
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
      res.status(200).json({
        maintenance: maintenance[0] ?? { is_maintenance_mode: false, maintenance_message: null },
        feedback_gate: gate[0] ?? { enabled: false, scope: 'everywhere' },
      });
      return;
    }

    res.status(400).json({ error: 'unknown resource' });
  } catch (err) {
    res.status(502).json({ error: 'fetch failed', detail: String((err as Error)?.message || err) });
  }
}
