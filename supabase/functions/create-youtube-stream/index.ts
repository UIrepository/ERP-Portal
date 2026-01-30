import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { title, description } = await req.json();

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
    if (!tokenData.access_token) {
      console.error('Token Refresh Failed:', tokenData);
      throw new Error('Failed to refresh YouTube access token');
    }
    const accessToken = tokenData.access_token;

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
          enableAutoStop: true,
          recordFromStart: true,
          latencyPreference: 'low' // Added for faster startup
        }
      }),
    });
    
    const broadcast = await broadcastRes.json();
    if (!broadcast.id) {
        throw new Error(`Broadcast Error: ${JSON.stringify(broadcast)}`);
    }

    // 2. Create Stream
    const streamRes = await fetch('https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: { title: `Stream for ${title}` },
        cdn: {
          format: '1080p',
          ingestionType: 'rtmp',
          resolution: '1080p',
          frameRate: '30fps' 
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
