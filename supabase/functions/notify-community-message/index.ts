// Push-only notifier for community messages. Called by a DB trigger on every
// community_messages INSERT, so both students AND assigned teachers of the
// batch+subject get a WhatsApp-style push (no email). The sender is excluded,
// and a per-community tag threads repeated messages into one updating
// notification instead of spamming.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPushToBatchSubject } from '../_shared/push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { batch, subject, sender_id, sender_name, content } = await req.json();
    if (!batch || !subject) {
      return new Response(JSON.stringify({ error: 'Missing batch or subject' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const preview = content
      ? (String(content).length > 80 ? `${String(content).slice(0, 80)}…` : String(content))
      : 'Sent an attachment';

    const result = await sendPushToBatchSubject(
      supabase,
      batch,
      subject,
      {
        title: `${sender_name || 'New message'} · ${subject}`,
        body: preview,
        url: `/portal/student/community?batch=${encodeURIComponent(batch)}&subject=${encodeURIComponent(subject)}`,
        // Thread by community: repeated messages update one notification.
        tag: `community-${batch}-${subject}`,
      },
      sender_id || undefined,
    );

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('notify-community-message error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
