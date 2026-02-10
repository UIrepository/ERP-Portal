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
  if (!keyRaw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');

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

async function ensureGoogleGroup(
  accessToken: string,
  email: string,
  name: string
): Promise<{ status: string }> {
  const res = await fetch('https://admin.googleapis.com/admin/directory/v1/groups', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, name, description: 'Auto-created by Unknown IITians ERP' }),
  });

  const data = await res.json();
  if (res.status === 409) return { status: 'already_exists' };
  if (!res.ok) throw new Error(`Create group ${email} failed: ${JSON.stringify(data)}`);
  return { status: 'created' };
}

async function addMemberToGroup(
  accessToken: string,
  groupEmail: string,
  memberEmail: string
): Promise<{ status: string }> {
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
  if (res.status === 409) return { status: 'already_member' };
  if (!res.ok) throw new Error(`Add ${memberEmail} to ${groupEmail} failed: ${JSON.stringify(data)}`);
  return { status: 'added' };
}

// Small delay to respect Google API rate limits
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const domain = Deno.env.get('GOOGLE_GROUPS_DOMAIN') || 'unknowniitians.com';
    const accessToken = await getGoogleAccessToken();

    // 1. Fetch ALL enrollments with emails
    const { data: enrollments, error: enrollErr } = await supabase
      .from('user_enrollments')
      .select('email, batch_name, subject_name')
      .not('email', 'is', null);

    if (enrollErr) throw new Error(`Fetch enrollments failed: ${enrollErr.message}`);
    if (!enrollments || enrollments.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No enrollments found', stats: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${enrollments.length} enrollments to process`);

    // 2. Build maps: unique batches, unique batch+subject, and their members
    const batchMembers: Record<string, Set<string>> = {};
    const subjectMembers: Record<string, Set<string>> = {};

    for (const e of enrollments) {
      const batchKey = e.batch_name;
      const subjectKey = `${e.batch_name}|||${e.subject_name}`;

      if (!batchMembers[batchKey]) batchMembers[batchKey] = new Set();
      batchMembers[batchKey].add(e.email);

      if (!subjectMembers[subjectKey]) subjectMembers[subjectKey] = new Set();
      subjectMembers[subjectKey].add(e.email);
    }

    const stats = {
      batches_processed: 0,
      subjects_processed: 0,
      groups_created: 0,
      groups_existed: 0,
      members_added: 0,
      members_existed: 0,
      errors: [] as string[],
    };

    // 3. Process BATCH groups (batchname-all@domain)
    for (const batchName of Object.keys(batchMembers)) {
      const batchSlug = sanitizeForEmail(batchName);
      const batchGroupEmail = `${batchSlug}-all@${domain}`;

      try {
        // Check if group exists in our DB
        const { data: existing } = await supabase
          .from('google_groups')
          .select('group_email')
          .eq('batch_name', batchName)
          .is('subject_name', null)
          .maybeSingle();

        const groupEmail = existing?.group_email || batchGroupEmail;

        // Ensure group exists in Google
        if (!existing) {
          const createRes = await ensureGoogleGroup(accessToken, batchGroupEmail, `${batchName} - All Students`);
          if (createRes.status === 'created') stats.groups_created++;
          else stats.groups_existed++;

          await supabase.from('google_groups').insert({
            batch_name: batchName,
            subject_name: null,
            group_email: batchGroupEmail,
            is_active: true,
          });
          await delay(200);
        } else {
          // Still ensure it exists in Google (might have been deleted)
          const createRes = await ensureGoogleGroup(accessToken, groupEmail, `${batchName} - All Students`);
          if (createRes.status === 'created') stats.groups_created++;
          else stats.groups_existed++;
          await delay(200);
        }

        // Add all members
        for (const email of batchMembers[batchName]) {
          try {
            const addRes = await addMemberToGroup(accessToken, groupEmail, email);
            if (addRes.status === 'added') stats.members_added++;
            else stats.members_existed++;
          } catch (err) {
            stats.errors.push(`batch-member: ${email} → ${groupEmail}: ${(err as Error).message}`);
          }
          await delay(100); // Rate limit
        }

        stats.batches_processed++;
        console.log(`✅ Batch group done: ${groupEmail} (${batchMembers[batchName].size} members)`);
      } catch (err) {
        stats.errors.push(`batch-group: ${batchName}: ${(err as Error).message}`);
        console.error(`❌ Batch group failed: ${batchName}`, err);
      }
    }

    // 4. Process SUBJECT groups (batchname-subject@domain)
    for (const key of Object.keys(subjectMembers)) {
      const [batchName, subjectName] = key.split('|||');
      const batchSlug = sanitizeForEmail(batchName);
      const subjectSlug = sanitizeForEmail(subjectName);
      const subjectGroupEmail = `${batchSlug}-${subjectSlug}@${domain}`;

      try {
        const { data: existing } = await supabase
          .from('google_groups')
          .select('group_email')
          .eq('batch_name', batchName)
          .eq('subject_name', subjectName)
          .maybeSingle();

        const groupEmail = existing?.group_email || subjectGroupEmail;

        if (!existing) {
          const createRes = await ensureGoogleGroup(accessToken, subjectGroupEmail, `${batchName} - ${subjectName}`);
          if (createRes.status === 'created') stats.groups_created++;
          else stats.groups_existed++;

          await supabase.from('google_groups').insert({
            batch_name: batchName,
            subject_name: subjectName,
            group_email: subjectGroupEmail,
            is_active: true,
          });
          await delay(200);
        } else {
          const createRes = await ensureGoogleGroup(accessToken, groupEmail, `${batchName} - ${subjectName}`);
          if (createRes.status === 'created') stats.groups_created++;
          else stats.groups_existed++;
          await delay(200);
        }

        for (const email of subjectMembers[key]) {
          try {
            const addRes = await addMemberToGroup(accessToken, groupEmail, email);
            if (addRes.status === 'added') stats.members_added++;
            else stats.members_existed++;
          } catch (err) {
            stats.errors.push(`subject-member: ${email} → ${groupEmail}: ${(err as Error).message}`);
          }
          await delay(100);
        }

        stats.subjects_processed++;
        console.log(`✅ Subject group done: ${groupEmail} (${subjectMembers[key].size} members)`);
      } catch (err) {
        stats.errors.push(`subject-group: ${batchName}/${subjectName}: ${(err as Error).message}`);
        console.error(`❌ Subject group failed: ${batchName}/${subjectName}`, err);
      }
    }

    console.log('Sync complete:', JSON.stringify(stats));

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('sync-google-groups fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
