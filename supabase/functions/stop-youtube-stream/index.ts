import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { broadcastId } = await req.json();
    if (!broadcastId) throw new Error('Broadcast ID is required');

    const refreshUrl = 'https://oauth2.googleapis.com/token';
    const refreshBody = new URLSearchParams({
      client_id: Deno.env.get('YOUTUBE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('YOUTUBE_CLIENT_SECRET') ?? '',
      refresh_token: Deno.env.get('YOUTUBE_REFRESH_TOKEN') ?? '',
      grant_type: 'refresh_token',
    });

    const tokenRes = await fetch(refreshUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: refreshBody,
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const transitionRes = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?id=${broadcastId}&broadcastStatus=complete&part=id,status`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!transitionRes.ok) {
      const err = await transitionRes.json();
      console.error('YouTube Transition Error:', err);
      throw new Error('Failed to stop broadcast on YouTube');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
