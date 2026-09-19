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
 * WHO IS ASKING — two accepted proofs, never a claim:
 *
 *   1. Authorization: Bearer <access token from unknowniitians.com>
 *      We hand the token to the WEBSITE project's own /auth/v1/user, which
 *      verifies its signature and expiry and returns the real account. The
 *      email comes from that response. A forged or expired token dies there.
 *      This is the normal path and it is safe to expose to a browser: the
 *      token proves the identity end to end, so a visitor calling this
 *      directly can still only ever reach their own entitlements.
 *
 *   2. x-bridge-secret + x-viewer-email
 *      Server-to-server escape hatch for a trusted backend that has already
 *      done its own verification. Only active when CATALOG_BRIDGE_SECRET is
 *      configured. Nothing depends on it today.
 *
 * An unverified email header on its own is ignored completely.
 *
 * Responses are single-item and never cacheable. There is no endpoint anywhere
 * that returns more than one URL at a time.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** The main website's Supabase project — the issuer whose tokens we trust. */
const WEBSITE_SUPABASE_URL =
  Deno.env.get('WEBSITE_SUPABASE_URL') ?? 'https://qzrvctpwefhmcduariuw.supabase.co';
const WEBSITE_ANON_KEY = Deno.env.get('WEBSITE_SUPABASE_ANON_KEY') ?? '';

const ALLOWED_ORIGINS = [
  'https://www.unknowniitians.com',
  'https://unknowniitians.com',
  'http://localhost:8080',
  'http://localhost:5173',
];

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bridge-secret, x-viewer-email',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

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

/**
 * Pulls the bare YouTube id out of any shape we store:
 *   /embed/<id>, /embed/<id>?si=…, /live/<id>, watch?v=<id>, youtu.be/<id>
 * Returns null for anything that is not YouTube (Drive previews, etc).
 *
 * We hand the player an id instead of a URL so the response never contains a
 * copy-pasteable youtube.com link. The id is still the secret — this narrows
 * the exposure, it does not remove it. Real protection needs signed hosting.
 */
function youtubeId(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com|youtube-nocookie\.com)\/(?:embed|live|v)\/([A-Za-z0-9_-]{6,})/) ??
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ??
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

/** Which column on which table holds the address, per catalog source_table. */
const URL_COLUMN: Record<string, string> = {
  recordings:  'embed_link',
  notes:       'file_url',
  dpp_content: 'link',
};

/** Verifies a main-website access token and returns its email, or null. */
async function emailFromWebsiteToken(token: string): Promise<string | null> {
  if (!WEBSITE_ANON_KEY) {
    console.error('WEBSITE_SUPABASE_ANON_KEY is not configured');
    return null;
  }
  try {
    const res = await fetch(`${WEBSITE_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: WEBSITE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { email?: string | null };
    return user?.email?.trim().toLowerCase() || null;
  } catch (err) {
    console.error('token verification failed', err);
    return null;
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ allowed: false, reason: 'method_not_allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const catalogId: string | undefined = body?.catalog_id;
    if (!catalogId) return json({ allowed: false, reason: 'bad_request' }, 400);

    // ---- establish who is asking -------------------------------------------
    let viewerEmail: string | null = null;

    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      // The anon key is itself a Bearer token; it carries no user, so
      // /auth/v1/user rejects it and we simply get null. No special case needed.
      if (token) viewerEmail = await emailFromWebsiteToken(token);
    }

    if (!viewerEmail) {
      const bridgeSecret = Deno.env.get('CATALOG_BRIDGE_SECRET');
      const presented = req.headers.get('x-bridge-secret') ?? '';
      if (bridgeSecret && presented && secretMatches(presented, bridgeSecret)) {
        viewerEmail = req.headers.get('x-viewer-email')?.trim().toLowerCase() || null;
      }
    }
    // ------------------------------------------------------------------------

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

    let entitled = item.is_free_preview === true;
    if (!entitled) {
      const { data, error } = await supabase.rpc('has_content_entitlement', {
        p_email:   viewerEmail,
        p_batch:   item.batch,
        p_subject: item.subject,
      });
      if (error) {
        // Fail CLOSED. An entitlement check that errors must never be read as
        // "allowed" — that is exactly how paywalls quietly fall open.
        console.error('entitlement check failed', error);
        return json({ allowed: false, reason: 'unavailable' }, 500);
      }
      entitled = data === true;
    }

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

    // For a YouTube lecture, send ONLY the id. The website mounts it through
    // the IFrame API with YouTube's own chrome switched off, exactly like the
    // portal does, so no youtube.com URL is ever handed to the page.
    const ytId = item.content_type === 'video' ? youtubeId(url) : null;

    return json({
      allowed:  true,
      type:     item.content_type,
      title:    item.title,
      free:     item.is_free_preview,
      ...(ytId ? { video_id: ytId } : { url }),
    });
  } catch (err) {
    console.error('resolve-content error', err);
    return json({ allowed: false, reason: 'unavailable' }, 500);
  }
});
