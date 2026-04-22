import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://ssp.unknowniitians.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(): Promise<string> {
  const refreshBody = new URLSearchParams({
    client_id: Deno.env.get('YOUTUBE_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('YOUTUBE_CLIENT_SECRET') ?? '',
    refresh_token: Deno.env.get('YOUTUBE_REFRESH_TOKEN') ?? '',
    grant_type: 'refresh_token',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: refreshBody,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    console.error('Token Refresh Failed:', tokenData);
    throw new Error('Failed to refresh YouTube access token');
  }
  return tokenData.access_token;
}

// Best-effort cleanup of stale broadcasts and idle stream resources.
// If the bound liveStream is left behind, YouTube can keep rejecting new
// ingests with "All our stream servers are busy" even after the broadcast is gone.
async function cleanupStaleBroadcasts(accessToken: string) {
  try {
    const listRes = await fetch(
      'https://www.googleapis.com/youtube/v3/liveBroadcasts?broadcastStatus=upcoming&mine=true&part=id,snippet,status,contentDetails&maxResults=50',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) return;
    const data = await listRes.json();
    const items = data.items ?? [];
    const staleThreshold = Date.now() - 30 * 60 * 1000;

    for (const item of items) {
      const created = item.snippet?.publishedAt
        ? new Date(item.snippet.publishedAt).getTime()
        : 0;
      const lifeCycle = item.status?.lifeCycleStatus;
      const boundStreamId = item.contentDetails?.boundStreamId;
      // Only delete clearly orphaned broadcasts that never went live
      if (
        created &&
        created < staleThreshold &&
        ['created', 'ready'].includes(lifeCycle)
      ) {
        await fetch(
          `https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${item.id}`,
          { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } }
        ).catch(() => {});

        if (boundStreamId) {
          await fetch(
            `https://www.googleapis.com/youtube/v3/liveStreams?id=${boundStreamId}`,
            { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } }
          ).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('Stale broadcast cleanup failed (non-fatal):', err);
  }
}

async function cleanupIdleStreams(accessToken: string) {
  try {
    const listRes = await fetch(
      'https://www.googleapis.com/youtube/v3/liveStreams?mine=true&part=id,snippet,status,contentDetails,cdn&maxResults=50',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) return;

    const data = await listRes.json();
    const items = data.items ?? [];
    const staleThreshold = Date.now() - 30 * 60 * 1000;

    for (const item of items) {
      const created = item.snippet?.publishedAt
        ? new Date(item.snippet.publishedAt).getTime()
        : 0;
      const streamStatus = item.status?.streamStatus;
      const isReusable = item.contentDetails?.isReusable === true;

      if (
        created &&
        created < staleThreshold &&
        ['created', 'inactive', 'ready', 'error'].includes(streamStatus) &&
        isReusable
      ) {
        await fetch(
          `https://www.googleapis.com/youtube/v3/liveStreams?id=${item.id}`,
          { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } }
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Idle stream cleanup failed (non-fatal):', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { title, description } = await req.json();
    const accessToken = await getAccessToken();

    // Pre-clean to avoid channel-level throttling
    await cleanupStaleBroadcasts(accessToken);
    await cleanupIdleStreams(accessToken);

    // 1. Create Broadcast (Unlisted)
    const broadcastRes = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          title: title,
          description: description,
          scheduledStartTime: new Date().toISOString(),
        },
        status: { 
          privacyStatus: 'unlisted',
          selfDeclaredMadeForKids: false 
        }, 
        contentDetails: { 
          enableAutoStart: true, 
          enableAutoStop: false, // Must be FALSE to allow reconnection
          recordFromStart: true,
          latencyPreference: 'low'
        }
      }),
    });
    
    const broadcast = await broadcastRes.json();
    if (!broadcast.id) {
        throw new Error(`Broadcast Error: ${JSON.stringify(broadcast)}`);
    }

    // 2. Create Stream — variable profile so Jitsi's 720p/30fps RTMP is accepted,
    // and reusable so reconnects don't get rejected as "servers busy".
    const streamRes = await fetch('https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn,contentDetails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: { title: `Stream for ${title}` },
        cdn: {
          format: 'variable',
          ingestionType: 'rtmp',
          resolution: 'variable',
          frameRate: 'variable'
        },
        contentDetails: {
          isReusable: true
        }
      }),
    });

    const stream = await streamRes.json();
    if (!stream.id) {
        throw new Error(`Stream Error: ${JSON.stringify(stream)}`);
    }

    // 3. Bind
    const bindRes = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcast.id}&streamId=${stream.id}&part=id`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (!bindRes.ok) {
        throw new Error('Failed to bind stream to broadcast');
    }

    return new Response(
      JSON.stringify({
        streamKey: stream.cdn.ingestionInfo.streamName,
        videoId: broadcast.id, 
        streamId: stream.id,
        videoUrl: `https://youtu.be/${broadcast.id}`,
        embedLink: `https://www.youtube.com/embed/${broadcast.id}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
