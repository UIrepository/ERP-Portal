// Signs Cloudinary upload requests. The API secret stays here (server-side);
// the browser only receives a short-lived signature.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// cloud name + api key are public (sent in every upload); only the secret is sensitive.
const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? 'drrits4mq';
const API_KEY = Deno.env.get('CLOUDINARY_API_KEY') ?? '819424178256119';
const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET') ?? '';

async function sha1Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!API_SECRET) {
      return new Response(JSON.stringify({ error: 'CLOUDINARY_API_SECRET not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const timestamp = Math.floor(Date.now() / 1000);

    // Build the params Cloudinary must sign (all sent params except
    // file/api_key/cloud_name/resource_type/signature), sorted alphabetically.
    // folder for normal uploads; public_id + overwrite + invalidate for
    // deterministic "overwrite the same object" uploads (e.g. class whiteboard
    // snapshots — one file per board, no orphans).
    const signed: Record<string, string> = { timestamp: String(timestamp) };
    if (typeof body?.folder === 'string') signed.folder = body.folder;
    if (typeof body?.public_id === 'string') signed.public_id = body.public_id;
    if (body?.overwrite) signed.overwrite = 'true';
    if (body?.invalidate) signed.invalidate = 'true';
    // Back-compat: when neither folder nor public_id is given, default the folder.
    if (!signed.folder && !signed.public_id) signed.folder = 'chat_uploads';

    const toSign = Object.keys(signed).sort().map((k) => `${k}=${signed[k]}`).join('&');
    const signature = await sha1Hex(toSign + API_SECRET);

    return new Response(
      JSON.stringify({ signature, timestamp, api_key: API_KEY, cloud_name: CLOUD_NAME, folder: signed.folder ?? null, params: signed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
