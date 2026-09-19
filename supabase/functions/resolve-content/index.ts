/**
 * POST /resolve-content   { catalog_id }
 *
 * The paywall. Turns one opaque catalog id into one playable/downloadable
 * address — and only for someone who has paid for that batch + subject, or for
 * an item an admin has explicitly marked as a free preview.
 *
 * This is the ONLY place in the system where a content URL crosses a network
 * boundary toward a viewer, which is what makes the guarantee checkable.
 *
 * DELIBERATELY NOT BROWSER-REACHABLE.
 * There are no CORS headers and the caller must present CATALOG_BRIDGE_SECRET.
 * The only legitimate caller is the main website's /api/unlock route, which has
 * already verified the viewer's Supabase session and passes the email it read
 * out of that verified token. A browser cannot reach this function, so a
 * forged x-viewer-email is not a path an attacker has.
 *
 * Responses are single-item and never cacheable. There is no endpoint anywhere
 * that returns more than one URL at a time.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Length-safe, constant-time string compare — no early exit on first mismatch. */
function secretMatches(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Which column on which table holds the address, per catalog source_table. */
const URL_COLUMN: Record<string, string> = {
  recordings:  'embed_link',
  notes:       'file_url',
  dpp_content: 'link',
};

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expected = Deno.env.get('CATALOG_BRIDGE_SECRET');
  if (!expected) {
    console.error('CATALOG_BRIDGE_SECRET is not configured');
    return json({ error: 'Not configured' }, 500);
  }

  const presented = req.headers.get('x-bridge-secret') ?? '';
  if (!secretMatches(presented, expected)) {
    // Same shape as any other denial — do not tell a prober which check failed.
    return json({ allowed: false, reason: 'forbidden' }, 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const catalogId: string | undefined = body?.catalog_id;
    // Comes from the website AFTER it verified the session token. Never trusted
    // from a browser, because a browser cannot call this function at all.
    const viewerEmail: string | undefined = req.headers.get('x-viewer-email')?.trim() || undefined;

    if (!catalogId) return json({ allowed: false, reason: 'bad_request' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: item, error: itemErr } = await supabase
      .from('content_catalog')
      .select('source_table, source_id, batch, subject, content_type, title, is_free_preview')
      .eq('id', catalogId)
      .maybeSingle();

    if (itemErr) {
      console.error('catalog lookup failed', itemErr);
      return json({ allowed: false, reason: 'unavailable' }, 500);
    }
    if (!item) return json({ allowed: false, reason: 'not_found' }, 404);

    // A signed-out visitor never resolves anything — not even a free item.
    // Free previews are the incentive to create an account, so they require one.
    if (!viewerEmail) {
      return json(
        { allowed: false, reason: 'login_required', batch: item.batch, subject: item.subject },
        401,
      );
    }

    const entitled = item.is_free_preview
      ? true
      : await (async () => {
          const { data, error } = await supabase.rpc('has_content_entitlement', {
            p_email:   viewerEmail,
            p_batch:   item.batch,
            p_subject: item.subject,
          });
          if (error) {
            // Fail CLOSED. An entitlement check that errors must never be read
            // as "allowed" — that is exactly how paywalls quietly fall open.
            console.error('entitlement check failed', error);
            throw new Error('entitlement_check_failed');
          }
          return data === true;
        })();

    if (!entitled) {
      return json(
        { allowed: false, reason: 'not_purchased', batch: item.batch, subject: item.subject },
        403,
      );
    }

    const column = URL_COLUMN[item.source_table];
    if (!column) {
      console.error('unmapped source_table', item.source_table);
      return json({ allowed: false, reason: 'unavailable' }, 500);
    }

    const { data: source, error: srcErr } = await supabase
      .from(item.source_table)
      .select(column)
      .eq('id', item.source_id)
      .maybeSingle();

    if (srcErr || !source) {
      console.error('source lookup failed', srcErr);
      return json({ allowed: false, reason: 'unavailable' }, 500);
    }

    const url = (source as Record<string, string | null>)[column];
    if (!url) return json({ allowed: false, reason: 'no_content' }, 404);

    console.log(
      `resolved ${item.content_type} ${catalogId} for ${viewerEmail} ` +
      `(${item.is_free_preview ? 'free preview' : 'purchased'})`,
    );

    return json({
      allowed: true,
      type:    item.content_type,
      title:   item.title,
      url,
      free:    item.is_free_preview,
    });
  } catch (err) {
    console.error('resolve-content error', err);
    return json({ allowed: false, reason: 'unavailable' }, 500);
  }
});
