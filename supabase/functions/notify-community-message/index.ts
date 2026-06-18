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

    // Is the sender staff (admin / manager / teacher)? Staff announcements always
    // notify everyone — a student's mute only silences PEER (student) messages.
    let senderIsStaff = false;
    if (sender_id) {
      for (const table of ['admins', 'managers', 'teachers']) {
        const { data } = await supabase.from(table).select('user_id').eq('user_id', sender_id).limit(1);
        if (data && data.length > 0) { senderIsStaff = true; break; }
      }
    }

    // For peer messages, drop students who muted this community.
    let mutedIds: string[] = [];
    if (!senderIsStaff) {
      const { data: mutes } = await supabase
        .from('community_mutes')
        .select('user_id')
        .eq('batch', batch)
        .eq('subject', subject);
      mutedIds = (mutes ?? []).map((m: { user_id?: string }) => m.user_id).filter(Boolean) as string[];
    }

    // WhatsApp group style: the subject is the "group" title, each line is
    // "Sender: message". The service worker stacks unseen lines into one
    // notification (data.stack) and threads them by the community tag.
    const sender = sender_name || 'New message';
    const result = await sendPushToBatchSubject(
      supabase,
      batch,
      subject,
      {
        title: subject,
        body: `${sender}: ${preview}`,
        url: `/portal/student/community?batch=${encodeURIComponent(batch)}&subject=${encodeURIComponent(subject)}`,
        // Thread by community: repeated messages compile into one notification.
        tag: `community-${batch}-${subject}`,
        stack: true,
      },
      sender_id || undefined,
      mutedIds,
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
