import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  sendPushToUserIds,
  sendPushToAllStudents,
  sendPushToStudents,
  type PushPayload,
} from '../_shared/push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// Generic push sender.
// Body: { title, body, url?, tag?, user_ids?: string[], batch?, subject?, all_students?: boolean }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // AUTHORIZATION: this endpoint can broadcast push to all students, so it must
    // be restricted to authenticated admins/managers. (The email functions call
    // the push helper directly and don't hit this HTTP endpoint.)
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: authData, error: authErr } = await supabase.auth.getUser(jwt);
    const caller = authData?.user;
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const [{ data: adminRow }, { data: managerRow }] = await Promise.all([
      supabase.from('admins').select('user_id').eq('user_id', caller.id).maybeSingle(),
      supabase.from('managers').select('user_id').eq('user_id', caller.id).maybeSingle(),
    ]);
    if (!adminRow && !managerRow) {
      return new Response(JSON.stringify({ error: 'Forbidden — staff only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { title, body, url, tag, user_ids, batch, subject, all_students } = await req.json();

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
    } else if (all_students) {
      result = await sendPushToAllStudents(supabase, payload);
    } else if (batch && subject) {
      result = await sendPushToStudents(supabase, { batch, subject }, payload);
    } else if (batch || subject) {
      result = await sendPushToStudents(supabase, { batch: batch ?? null, subject: subject ?? null }, payload);
    } else {
      return new Response(
        JSON.stringify({ error: 'Provide user_ids[], all_students, or batch/subject filters' }),
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
