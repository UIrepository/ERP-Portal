// @ts-nocheck
// Worker that drains public.group_addition_queue by adding each member to the
// specified Google Group. Designed to be invoked every minute by pg_cron.
// Processes up to BATCH_SIZE per run with a short inter-call delay to stay well
// under Google Directory API quotas (~10 QPS safe).
//
// Auth to Google: same service-account JWT flow as manage-google-group
// (env: GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_ADMIN_EMAIL).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v5.2.0/index.ts';

const BATCH_SIZE = 100;             // rows per cron tick (stays within edge worker CPU/time budget)
const INTER_CALL_DELAY_MS = 100;    // 10 QPS — at Google's recommended safe ceiling
const ADMIN_MEMBER_EMAIL = 'desk@unknowniitians.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

async function getGoogleAccessToken(): Promise<string> {
  const keyRaw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!keyRaw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  const keyJson = JSON.parse(keyRaw);
  const adminEmail = Deno.env.get('GOOGLE_ADMIN_EMAIL');
  if (!adminEmail) throw new Error('GOOGLE_ADMIN_EMAIL not configured');

  const privateKey = await importPKCS8(keyJson.private_key, 'RS256');
  const jwt = await new SignJWT({
    scope: [
      'https://www.googleapis.com/auth/admin.directory.group',
      'https://www.googleapis.com/auth/admin.directory.group.member',
    ].join(' '),
    sub: adminEmail,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(keyJson.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google auth failed: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function groupExists(accessToken: string, groupEmail: string): Promise<boolean> {
  const res = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.ok;
}

async function ensureGroup(accessToken: string, groupEmail: string): Promise<void> {
  const exists = await groupExists(accessToken, groupEmail);
  if (!exists) {
    const res = await fetch('https://admin.googleapis.com/admin/directory/v1/groups', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: groupEmail,
        name: groupEmail.split('@')[0],
        description: 'Auto-created by Unknown IITians ERP queue processor',
      }),
    });
    if (!res.ok && res.status !== 409) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Create group ${groupEmail} failed: ${JSON.stringify(body)}`);
    }
  }

  // Ensure desk@ is OWNER (idempotent).
  await fetch(
    `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_MEMBER_EMAIL, role: 'OWNER' }),
    }
  ).catch(() => {});
  // If desk@ was already a plain MEMBER, upgrade them to OWNER.
  await fetch(
    `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members/${encodeURIComponent(ADMIN_MEMBER_EMAIL)}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_MEMBER_EMAIL, role: 'OWNER' }),
    }
  ).catch(() => {});
}

type AddResult = { kind: 'success' | 'skipped' | 'failed'; error?: string };

async function addMember(
  accessToken: string,
  groupEmail: string,
  memberEmail: string,
  role: 'MEMBER' | 'MANAGER' | 'OWNER' = 'MEMBER'
): Promise<AddResult> {
  const res = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: memberEmail, role }),
    }
  );

  if (res.status === 409) {
    // Already a member — if we asked for a higher role, upgrade via PUT.
    if (role !== 'MEMBER') {
      const putRes = await fetch(
        `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members/${encodeURIComponent(memberEmail)}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: memberEmail, role }),
        }
      );
      if (putRes.ok) return { kind: 'success' };
    }
    return { kind: 'skipped' };
  }
  if (res.status === 204 || res.ok) return { kind: 'success' };
  const body = await res.text();
  return { kind: 'failed', error: `${res.status}: ${body.slice(0, 400)}` };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const started = Date.now();
  const stats = { claimed: 0, success: 0, skipped: 0, failed: 0, elapsed_ms: 0 };

  try {
    const { data: claimed, error: claimErr } = await supabase.rpc('claim_group_addition_batch', {
      p_limit: BATCH_SIZE,
    });
    if (claimErr) throw claimErr;
    if (!claimed || claimed.length === 0) {
      return new Response(JSON.stringify({ ...stats, message: 'queue empty' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    stats.claimed = claimed.length;

    const accessToken = await getGoogleAccessToken();

    // Ensure every distinct group in this batch actually exists on Google before we start
    const uniqueGroups = [...new Set(claimed.map((r: any) => r.group_email))] as string[];
    for (const g of uniqueGroups) {
      try {
        await ensureGroup(accessToken, g);
      } catch (e) {
        console.error(`ensureGroup failed for ${g}:`, e);
      }
    }

    for (const row of claimed as any[]) {
      try {
        const role = (row.role ?? 'MEMBER') as 'MEMBER' | 'MANAGER' | 'OWNER';
        const result = await addMember(accessToken, row.group_email, row.email, role);

        if (result.kind === 'success') stats.success++;
        else if (result.kind === 'skipped') stats.skipped++;
        else stats.failed++;

        const newStatus =
          result.kind === 'failed' && row.attempts < row.max_attempts ? 'pending' : result.kind;

        await supabase
          .from('group_addition_queue')
          .update({
            status: newStatus,
            last_error: result.error ?? null,
            processed_at: newStatus === 'pending' ? null : new Date().toISOString(),
          })
          .eq('id', row.id);
      } catch (e: any) {
        stats.failed++;
        await supabase
          .from('group_addition_queue')
          .update({
            status: row.attempts < row.max_attempts ? 'pending' : 'failed',
            last_error: String(e?.message ?? e).slice(0, 500),
            processed_at: row.attempts < row.max_attempts ? null : new Date().toISOString(),
          })
          .eq('id', row.id);
      }

      await sleep(INTER_CALL_DELAY_MS);
    }

    stats.elapsed_ms = Date.now() - started;
    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    stats.elapsed_ms = Date.now() - started;
    console.error('Queue processor fatal:', e);
    return new Response(
      JSON.stringify({ ...stats, error: String(e?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
