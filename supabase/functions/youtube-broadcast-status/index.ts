// Read-only YouTube broadcast status check (for monitoring a live stream).
// Returns the broadcast lifecycle + the bound ingestion stream's health, so we
// can see whether a stream is live, dropped (no data), or completed.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { broadcastId } = await req.json();
    if (!broadcastId) throw new Error('broadcastId is required');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('YOUTUBE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('YOUTUBE_CLIENT_SECRET') ?? '',
        refresh_token: Deno.env.get('YOUTUBE_REFRESH_TOKEN') ?? '',
        grant_type: 'refresh_token',
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error('Failed to refresh YouTube access token');

    const bRes = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${broadcastId}&part=status,contentDetails,snippet`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const bData = await bRes.json();
    const b = bData.items?.[0];
    if (!b) {
      return new Response(JSON.stringify({ found: false, broadcastId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lifeCycleStatus = b.status?.lifeCycleStatus;
    const boundStreamId = b.contentDetails?.boundStreamId;
    let streamStatus = null;
    let healthStatus = null;
    if (boundStreamId) {
      const sRes = await fetch(
        `https://www.googleapis.com/youtube/v3/liveStreams?id=${boundStreamId}&part=status`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const sData = await sRes.json();
      const s = sData.items?.[0];
      streamStatus = s?.status?.streamStatus ?? null;        // active | inactive | ready | error
      healthStatus = s?.status?.healthStatus?.status ?? null; // good | ok | bad | noData
    }

    return new Response(
      JSON.stringify({
        found: true,
        broadcastId,
        title: b.snippet?.title,
        lifeCycleStatus,   // testing | live | complete | revoked ...
        boundStreamId,
        streamStatus,      // active = encoder pushing; inactive/noData = dropped
        healthStatus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
