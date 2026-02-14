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
  if (!keyRaw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured.');

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

async function handleAddMember(req: any) {
  const { student_email, batch_name, subject_name } = req;

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

  // === BATCH GROUP ===
  const batchSlug = sanitizeForEmail(batch_name);
  const batchGroupEmail = `${batchSlug}-all@${domain}`;

  const { data: batchGroup } = await supabase
    .from('google_groups')
    .select('group_email')
    .eq('batch_name', batch_name)
    .is('subject_name', null)
    .maybeSingle();

  const actualBatchEmail = batchGroup?.group_email || batchGroupEmail;

  if (!batchGroup) {
    const createRes = await createGoogleGroup(accessToken, batchGroupEmail, `${batch_name} - All Students`);
    results.push({ group: batchGroupEmail, action: 'create_group', status: createRes.status });
    await supabase.from('google_groups').insert({ batch_name, subject_name: null, group_email: batchGroupEmail, is_active: true });
  }

  const batchAddRes = await addMember(accessToken, actualBatchEmail, student_email);
  results.push({ group: actualBatchEmail, action: 'add_member', status: batchAddRes.status });

  // === SUBJECT GROUP ===
  const subjectSlug = sanitizeForEmail(subject_name);
  const subjectGroupEmail = `${batchSlug}-${subjectSlug}@${domain}`;

  const { data: subjectGroup } = await supabase
    .from('google_groups')
    .select('group_email')
    .eq('batch_name', batch_name)
    .eq('subject_name', subject_name)
    .maybeSingle();

  const actualSubjectEmail = subjectGroup?.group_email || subjectGroupEmail;

  if (!subjectGroup) {
    const createRes = await createGoogleGroup(accessToken, subjectGroupEmail, `${batch_name} - ${subject_name}`);
    results.push({ group: subjectGroupEmail, action: 'create_group', status: createRes.status });
    await supabase.from('google_groups').insert({ batch_name, subject_name, group_email: subjectGroupEmail, is_active: true });
  }

  const subjectAddRes = await addMember(accessToken, actualSubjectEmail, student_email);
  results.push({ group: actualSubjectEmail, action: 'add_member', status: subjectAddRes.status });

  // === ALL STUDENTS GROUP ===
  const allStudentsEmail = `allstudents@${domain}`;
  try {
    const allStudentsAddRes = await addMember(accessToken, allStudentsEmail, student_email);
    results.push({ group: allStudentsEmail, action: 'add_member', status: allStudentsAddRes.status });
  } catch (err) {
    console.error(`Failed to add ${student_email} to ${allStudentsEmail}:`, err);
    results.push({ group: allStudentsEmail, action: 'add_member', status: `error: ${(err as Error).message}` });
  }

  return results;
}

async function handleBulkAddAllStudents(emails: string[]) {
  const domain = Deno.env.get('GOOGLE_GROUPS_DOMAIN') || 'unknowniitians.com';
  const allStudentsEmail = `allstudents@${domain}`;
  const accessToken = await getGoogleAccessToken();
  
  const results: { email: string; status: string }[] = [];
  
  // Process in batches of 10 to avoid rate limits
  for (let i = 0; i < emails.length; i += 10) {
    const batch = emails.slice(i, i + 10);
    const batchResults = await Promise.allSettled(
      batch.map(async (email) => {
        try {
          const res = await addMember(accessToken, allStudentsEmail, email);
          return { email, status: res.status };
        } catch (err) {
          console.error(`Failed to add ${email}:`, err);
          return { email, status: `error: ${(err as Error).message}` };
        }
      })
    );
    
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      } else {
        results.push({ email: 'unknown', status: `rejected: ${r.reason}` });
      }
    }
    
    // Small delay between batches to respect rate limits
    if (i + 10 < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const summary = {
    total: emails.length,
    added: results.filter(r => r.status === 'added').length,
    already_member: results.filter(r => r.status === 'already_member').length,
    errors: results.filter(r => r.status.startsWith('error')).length,
  };
  
  console.log('Bulk add summary:', JSON.stringify(summary));
  
  return { success: true, summary, results };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;
    console.log('manage-google-group request:', { action });

    if (action === 'add_member') {
      const results = await handleAddMember(body);
      if (results instanceof Response) return results; // validation error
      console.log('All results:', JSON.stringify(results));
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'bulk_add_allstudents') {
      const { emails } = body;
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return new Response(JSON.stringify({ error: 'Missing or empty emails array' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Clean emails: trim, lowercase, remove invalid ones
      const cleanEmails = emails
        .map((e: string) => e.trim().toLowerCase().replace(/\.$/, ''))
        .filter((e: string) => e.includes('@') && e.length > 3);
      
      console.log(`Processing ${cleanEmails.length} emails for allstudents group`);
      
      const result = await handleBulkAddAllStudents(cleanEmails);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Supported: add_member, bulk_add_allstudents' }), {
      status: 400,
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
