import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPushToUserIds, sendPushToBatchSubject, type PushPayload } from '../_shared/push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// Generic push sender.
// Body: { title, body, url?, tag?, user_ids?: string[], batch?, subject? }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { title, body, url, tag, user_ids, batch, subject } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'Missing title or body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: PushPayload = { title, body, url, tag };

    let result;
    if (Array.isArray(user_ids) && user_ids.length > 0) {
      result = await sendPushToUserIds(supabase, user_ids, payload);
    } else if (batch && subject) {
      result = await sendPushToBatchSubject(supabase, batch, subject, payload);
    } else {
      return new Response(
        JSON.stringify({ error: 'Provide user_ids[] or batch + subject' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-push error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
