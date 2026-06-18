// Push notifier for the support inbox / direct messages. Fired by a DB trigger
// on every direct_messages INSERT.
//   - support_admin from a student  -> push ALL admins (shared support queue)
//   - support_manager from a student -> push ALL managers
//   - a staff reply (support_*)      -> push the student (receiver)
//   - any other DM (doubts/general)  -> push the receiver
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPushToUserIds } from '../_shared/push.ts';

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

    const { sender_id, receiver_id, context, content } = await req.json();
    if (!sender_id) {
      return new Response(JSON.stringify({ error: 'Missing sender_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const preview = content
      ? (String(content).length > 90 ? `${String(content).slice(0, 90)}…` : String(content))
      : 'Sent an attachment';

    const { data: senderProfile } = await supabase
      .from('profiles').select('name').eq('user_id', sender_id).maybeSingle();
    const senderName = senderProfile?.name || 'Someone';

    // Staff id sets (service role bypasses RLS).
    const [{ data: adminsRows }, { data: managersRows }] = await Promise.all([
      supabase.from('admins').select('user_id').not('user_id', 'is', null),
      supabase.from('managers').select('user_id').not('user_id', 'is', null),
    ]);
    const adminIds = (adminsRows ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean);
    const managerIds = (managersRows ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean);

    let recipients: string[] = [];
    let payload: { title: string; body: string; url?: string; tag?: string; stack?: boolean };

    if (context === 'support_admin') {
      if (adminIds.includes(sender_id)) {
        // Admin replied -> notify the student.
        recipients = receiver_id ? [receiver_id] : [];
        payload = { title: 'Support replied', body: preview, url: '/', tag: `support-reply-${sender_id}` };
      } else {
        // Student opened/continued a support ticket -> notify all admins.
        recipients = adminIds;
        payload = { title: `Support · ${senderName}`, body: preview, url: '/admin-messages', tag: `support-admin-${sender_id}`, stack: true };
      }
    } else if (context === 'support_manager') {
      if (managerIds.includes(sender_id)) {
        recipients = receiver_id ? [receiver_id] : [];
        payload = { title: 'Support replied', body: preview, url: '/', tag: `support-reply-${sender_id}` };
      } else {
        recipients = managerIds;
        payload = { title: `Support · ${senderName}`, body: preview, url: '/manager-messages', tag: `support-manager-${sender_id}`, stack: true };
      }
    } else {
      // Direct message (subject doubt / general) -> notify the receiver.
      recipients = receiver_id ? [receiver_id] : [];
      payload = { title: senderName, body: preview, url: '/', tag: `dm-${sender_id}` };
    }

    // Never notify the sender of their own message.
    recipients = recipients.filter((id) => id && id !== sender_id);

    const result = await sendPushToUserIds(supabase, recipients, payload);

    return new Response(JSON.stringify({ success: true, recipients: recipients.length, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('notify-direct-message error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
