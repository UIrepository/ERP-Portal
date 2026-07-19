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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Mirrors the in-app MarkdownText renderer: **bold**, "- " bullets and pasted
// URLs become real links, so the email reads like the announcement students see.
function toHtml(message: string): string {
  const lines = message.split('\n');
  const out: string[] = [];
  let bullets: string[] = [];

  const inline = (raw: string) => {
    let s = escapeHtml(raw);
    s = s.replace(/((?:https?:\/\/|www\.)[^\s<>]+)/g, (m) => {
      const trail = m.match(/[),.;:!?\]]+$/)?.[0] ?? '';
      const url = trail ? m.slice(0, m.length - trail.length) : m;
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      return `<a href="${href}" style="color:#2563eb">${url}</a>${trail}`;
    });
    return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  };

  const flush = () => {
    if (!bullets.length) return;
    out.push(`<ul>${bullets.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`);
    bullets = [];
  };

  for (const line of lines) {
    const b = line.match(/^\s*[-*]\s+(.*)$/);
    if (b) {
      bullets.push(b[1]);
      continue;
    }
    flush();
    if (line.trim() === '') out.push('<br/>');
    else out.push(`<p style="margin:0 0 10px">${inline(line)}</p>`);
  }
  flush();
  return out.join('');
}

// Emails a student announcement to the Google Groups for the targeted
// batch/subject — the same channel schedule-change and recording emails use, so
// targeting stays consistent with the push that goes out alongside it.
// Body: { title, message, batch?, subject?, all_students? }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Staff-only: this can email whole batches, so restrict to admins/managers.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: authData, error: authErr } = await supabase.auth.getUser(jwt);
    const caller = authData?.user;
    if (authErr || !caller) return json({ error: 'Unauthorized' }, 401);

    const [{ data: adminRow }, { data: managerRow }] = await Promise.all([
      supabase.from('admins').select('user_id').eq('user_id', caller.id).maybeSingle(),
      supabase.from('managers').select('user_id').eq('user_id', caller.id).maybeSingle(),
    ]);
    if (!adminRow && !managerRow) return json({ error: 'Forbidden — staff only' }, 403);

    const { title, message, batch, subject, all_students } = await req.json();
    if (!title || !message) return json({ error: 'Missing title or message' }, 400);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return json({ error: 'RESEND_API_KEY not configured' }, 500);
    const resend = new Resend(resendKey);

    // Resolve recipient groups. An announcement may target a batch, a subject,
    // both, or everyone — narrow by whichever fields were supplied.
    type Group = { batch_name: string; subject_name: string | null; group_email: string };

    let q = supabase
      .from('google_groups')
      .select('batch_name, subject_name, group_email')
      .eq('is_active', true);
    if (!all_students) {
      if (batch) q = q.eq('batch_name', batch);
      if (subject) q = q.eq('subject_name', subject);
    }
    const { data: groups, error: gErr } = await q;
    if (gErr) return json({ error: gErr.message }, 500);

    const rows = (groups ?? []) as Group[];
    let selected: Group[];
    if (subject && !all_students) {
      // Subject-scoped announcement: the matched subject groups are exact.
      selected = rows;
    } else {
      // Batch-wide (or everyone): students belong to both their batch's "-all"
      // group and their subject group, so prefer the one batch-wide group per
      // batch to avoid mailing the same student several times. Batches without
      // one fall back to their subject groups.
      const byBatch = new Map<string, Group[]>();
      for (const r of rows) {
        const list = byBatch.get(r.batch_name) ?? [];
        list.push(r);
        byBatch.set(r.batch_name, list);
      }
      selected = [];
      for (const list of byBatch.values()) {
        const batchWide = list.find((r) => !r.subject_name);
        selected.push(...(batchWide ? [batchWide] : list));
      }
    }

    const emails = Array.from(
      new Set(selected.map((g) => g.group_email).filter(Boolean) as string[]),
    );
    if (emails.length === 0) return json({ success: true, sent: 0, note: 'no active groups matched' });

    const text = `Dear Student,\n\n${message}\n\n— Unknown IITians Academic Team`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111">
<p style="margin:0 0 12px">Dear Student,</p>
${toHtml(message)}
<p style="margin:16px 0 0;color:#555">— Unknown IITians Academic Team</p>
</div>`;

    const results = await Promise.allSettled(
      emails.map((to) =>
        resend.emails.send({
          from: 'Unknown IITians <notifications@hq.unknowniitians.com>',
          to: [to],
          subject: title,
          text,
          html,
        }),
      ),
    );
    const sent = results.filter((r) => r.status === 'fulfilled').length;

    return json({ success: true, sent, failed: results.length - sent, groups: emails.length });
  } catch (e) {
    console.error('send-announcement-email error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
