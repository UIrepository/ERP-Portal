import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { broadcastId } = await req.json();
    if (!broadcastId) throw new Error('Broadcast ID is required');

    // 1. Get access token
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
    if (!accessToken) throw new Error('Failed to refresh YouTube access token');

    // 2. Check broadcast's current status
    const statusRes = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${broadcastId}&part=status`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const statusData = await statusRes.json();

    if (!statusData.items || statusData.items.length === 0) {
      // Broadcast doesn't exist (maybe already deleted) — treat as success
      console.log('Broadcast not found, treating as already stopped.');
      return new Response(JSON.stringify({ success: true, message: 'Broadcast not found, already cleaned up.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lifeCycleStatus = statusData.items[0].status?.lifeCycleStatus;
    console.log('Broadcast lifeCycleStatus:', lifeCycleStatus);

    // 3. Handle based on status
    if (lifeCycleStatus === 'complete') {
      // Already stopped
      return new Response(JSON.stringify({ success: true, message: 'Broadcast already complete.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (lifeCycleStatus === 'live') {
      // Transition to complete
      const transitionRes = await fetch(
        `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?id=${broadcastId}&broadcastStatus=complete&part=id,status`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (!transitionRes.ok) {
        const err = await transitionRes.json();
        console.error('YouTube Transition Error:', err);
        throw new Error('Failed to stop broadcast on YouTube');
      }
      return new Response(JSON.stringify({ success: true, message: 'Broadcast transitioned to complete.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For created, ready, testing — delete the broadcast (cleanup)
    if (['created', 'ready', 'testing'].includes(lifeCycleStatus)) {
      const deleteRes = await fetch(
        `https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${broadcastId}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (!deleteRes.ok && deleteRes.status !== 404) {
        const err = await deleteRes.text();
        console.error('YouTube Delete Error:', err);
        // Still return success so frontend can clean up
      }
      return new Response(JSON.stringify({ success: true, message: `Broadcast was in "${lifeCycleStatus}" state and has been deleted.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Unknown status — return success anyway so UI doesn't get stuck
    console.warn('Unknown broadcast status:', lifeCycleStatus);
    return new Response(JSON.stringify({ success: true, message: `Broadcast in unexpected state "${lifeCycleStatus}". No action taken.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Edge Function Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
