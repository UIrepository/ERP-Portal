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
    const folder = typeof body?.folder === 'string' ? body.folder : 'chat_uploads';
    const timestamp = Math.floor(Date.now() / 1000);

    // Cloudinary signs the sent params (except file/api_key/cloud_name/resource_type),
    // sorted alphabetically, with the secret appended.
    const toSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = await sha1Hex(toSign + API_SECRET);

    return new Response(
      JSON.stringify({ signature, timestamp, api_key: API_KEY, cloud_name: CLOUD_NAME, folder }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
