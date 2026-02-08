import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v5.2.0/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function sanitizeForEmail(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
}

async function getGoogleAccessToken(): Promise<string> {
  const keyRaw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!keyRaw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured. You need Google Workspace with a service account for auto-member management.');

  const keyJson = JSON.parse(keyRaw);
  const adminEmail = Deno.env.get('GOOGLE_ADMIN_EMAIL');
  if (!adminEmail) throw new Error('GOOGLE_ADMIN_EMAIL not configured');

  const privateKey = await importPKCS8(keyJson.private_key, 'RS256');

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/admin.directory.group https://www.googleapis.com/auth/admin.directory.group.member',
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

async function createGoogleGroup(accessToken: string, email: string, name: string): Promise<{ status: string }> {
  const res = await fetch('https://admin.googleapis.com/admin/directory/v1/groups', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, name, description: 'Auto-created by Unknown IITians ERP' }),
  });

  const data = await res.json();
  if (res.status === 409) {
    console.log(`Group ${email} already exists`);
    return { status: 'already_exists' };
  }
  if (!res.ok) throw new Error(`Create group failed: ${JSON.stringify(data)}`);
  console.log(`Created group: ${email}`);
  return { status: 'created' };
}

async function addMember(accessToken: string, groupEmail: string, memberEmail: string): Promise<{ status: string }> {
  const res = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: memberEmail, role: 'MEMBER' }),
    }
  );

  const data = await res.json();
  if (res.status === 409) {
    console.log(`${memberEmail} is already a member of ${groupEmail}`);
    return { status: 'already_member' };
  }
  if (!res.ok) throw new Error(`Add member to ${groupEmail} failed: ${JSON.stringify(data)}`);
  console.log(`Added ${memberEmail} to ${groupEmail}`);
  return { status: 'added' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, student_email, batch_name, subject_name } = await req.json();
    console.log('manage-google-group request:', { action, student_email, batch_name, subject_name });

    if (action !== 'add_member') {
      return new Response(JSON.stringify({ error: 'Invalid action. Supported: add_member' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!student_email || !batch_name || !subject_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields: student_email, batch_name, subject_name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const domain = Deno.env.get('GOOGLE_GROUPS_DOMAIN') || 'unknowniitians.com';
    const accessToken = await getGoogleAccessToken();
    const results: { group: string; action: string; status: string }[] = [];

    // === BATCH GROUP (all students in this batch) ===
    const batchSlug = sanitizeForEmail(batch_name);
    const batchGroupEmail = `${batchSlug}-all@${domain}`;

    const { data: batchGroup } = await supabase
      .from('google_groups')
      .select('group_email')
      .eq('batch_name', batch_name)
      .is('subject_name', null)
      .maybeSingle();

    const actualBatchEmail = batchGroup?.group_email || batchGroupEmail;

    // Auto-create batch group if not in DB
    if (!batchGroup) {
      const createRes = await createGoogleGroup(accessToken, batchGroupEmail, `${batch_name} - All Students`);
      results.push({ group: batchGroupEmail, action: 'create_group', status: createRes.status });

      await supabase.from('google_groups').insert({
        batch_name,
        subject_name: null,
        group_email: batchGroupEmail,
        is_active: true,
      });
    }

    // Add student to batch group
    const batchAddRes = await addMember(accessToken, actualBatchEmail, student_email);
    results.push({ group: actualBatchEmail, action: 'add_member', status: batchAddRes.status });

    // === SUBJECT GROUP (batch + subject specific) ===
    const subjectSlug = sanitizeForEmail(subject_name);
    const subjectGroupEmail = `${batchSlug}-${subjectSlug}@${domain}`;

    const { data: subjectGroup } = await supabase
      .from('google_groups')
      .select('group_email')
      .eq('batch_name', batch_name)
      .eq('subject_name', subject_name)
      .maybeSingle();

    const actualSubjectEmail = subjectGroup?.group_email || subjectGroupEmail;

    // Auto-create subject group if not in DB
    if (!subjectGroup) {
      const createRes = await createGoogleGroup(accessToken, subjectGroupEmail, `${batch_name} - ${subject_name}`);
      results.push({ group: subjectGroupEmail, action: 'create_group', status: createRes.status });

      await supabase.from('google_groups').insert({
        batch_name,
        subject_name,
        group_email: subjectGroupEmail,
        is_active: true,
      });
    }

    // Add student to subject group
    const subjectAddRes = await addMember(accessToken, actualSubjectEmail, student_email);
    results.push({ group: actualSubjectEmail, action: 'add_member', status: subjectAddRes.status });

    console.log('All results:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('manage-google-group error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
