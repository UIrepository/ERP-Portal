import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Emails an admin announcement to specific teachers (resolved from the teachers
// table by user_id, so only real teachers can be addressed). Mirrors the in-app
// + push announcement created by the "Teacher Broadcast" admin tab.
// Body: { title, message, user_ids: string[] }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Staff-only: this can email any teacher, so restrict to admins/managers.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: authData, error: authErr } = await supabase.auth.getUser(jwt);
    const caller = authData?.user;
    if (authErr || !caller) return json({ error: 'Unauthorized' }, 401);

    const [{ data: adminRow }, { data: managerRow }] = await Promise.all([
      supabase.from('admins').select('user_id').eq('user_id', caller.id).maybeSingle(),
      supabase.from('managers').select('user_id').eq('user_id', caller.id).maybeSingle(),
    ]);
    if (!adminRow && !managerRow) return json({ error: 'Forbidden — staff only' }, 403);

    const { title, message, user_ids } = await req.json();
    if (!title || !message || !Array.isArray(user_ids) || user_ids.length === 0) {
      return json({ error: 'Missing title, message, or user_ids[]' }, 400);
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return json({ error: 'RESEND_API_KEY not configured' }, 500);
    const resend = new Resend(resendKey);

    // Resolve recipient emails from the teachers table (only real teachers).
    const { data: teachers } = await supabase
      .from('teachers')
      .select('email')
      .in('user_id', user_ids);
    const emails = Array.from(
      new Set((teachers ?? []).map((t: { email?: string }) => t.email).filter(Boolean) as string[]),
    );
    if (emails.length === 0) return json({ success: true, sent: 0, note: 'no emails on file' });

    const text = `Dear Teacher,

${message}

— Unknown IITians Admin Team`;

    const results = await Promise.allSettled(
      emails.map((to) =>
        resend.emails.send({
          from: 'Unknown IITians <notifications@hq.unknowniitians.com>',
          to: [to],
          subject: `[UI Staff] ${title}`,
          text,
        }),
      ),
    );
    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - sent;

    return json({ success: true, sent, failed });
  } catch (e) {
    console.error('send-teacher-announcement-email error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
