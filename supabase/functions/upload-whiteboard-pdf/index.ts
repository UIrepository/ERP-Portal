import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://ssp.unknowniitians.com',
  'http://localhost:8080',
  'http://localhost:5173',
];

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function getGoogleAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN')!,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Google token exchange failed: ' + JSON.stringify(data));
  }
  return data.access_token as string;
}

// Find a folder by name under an optional parent, creating it if missing.
// drive.file scope can see/list only folders this app created — which is all
// of them, since the app owns the whole tree.
async function findOrCreateFolder(token: string, name: string, parentId: string | null): Promise<string> {
  const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  let q = `name='${escaped}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;

  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const list = await listRes.json();
  if (Array.isArray(list.files) && list.files.length > 0) return list.files[0].id;

  const meta: Record<string, unknown> = { name, mimeType: FOLDER_MIME };
  if (parentId) meta.parents = [parentId];
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  const created = await createRes.json();
  if (!created.id) throw new Error('Folder create failed: ' + JSON.stringify(created));
  return created.id as string;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.split(',')[1] : b64; // tolerate data: prefix
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Invalid or expired token' }, 401);

    const { scheduleId, title, pdfBase64, postToNotes = true } = await req.json();
    if (!scheduleId || !pdfBase64) return json({ error: 'Missing scheduleId or pdfBase64' }, 400);

    // Resolve the class and confirm the caller is its teacher.
    const { data: schedule, error: schedErr } = await admin
      .from('schedules')
      .select('batch, subject')
      .eq('id', scheduleId)
      .maybeSingle();
    if (schedErr || !schedule) return json({ error: 'Schedule not found' }, 404);

    const { data: teacher } = await admin
      .from('teachers')
      .select('assigned_batches, assigned_subjects')
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdmin = !teacher
      ? (await admin.from('admins').select('id').eq('user_id', user.id).maybeSingle()).data != null
      : false;

    const teacherAllowed =
      teacher &&
      Array.isArray(teacher.assigned_batches) &&
      Array.isArray(teacher.assigned_subjects) &&
      teacher.assigned_batches.includes(schedule.batch) &&
      teacher.assigned_subjects.includes(schedule.subject);

    if (!teacherAllowed && !isAdmin) {
      return json({ error: 'You are not assigned to this class.' }, 403);
    }

    const safeTitle = String(title || 'whiteboard').replace(/[^a-z0-9_\-\s]/gi, '').trim() || 'whiteboard';
    const fileName = `${safeTitle}.pdf`;

    // Drive: build folder tree Root / <Batch> / <Subject>
    const accessToken = await getGoogleAccessToken();
    const rootName = Deno.env.get('WHITEBOARD_ROOT_FOLDER_NAME') || 'UI ERP Portal - Whiteboards';
    const rootId = await findOrCreateFolder(accessToken, rootName, null);
    const batchId = await findOrCreateFolder(accessToken, schedule.batch, rootId);
    const subjectId = await findOrCreateFolder(accessToken, schedule.subject, batchId);

    // Multipart upload of the PDF
    const pdfBytes = base64ToBytes(pdfBase64);
    const boundary = '----whiteboard' + crypto.randomUUID();
    const metadata = JSON.stringify({ name: fileName, parents: [subjectId] });
    const pre =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/pdf\r\n\r\n';
    const post = `\r\n--${boundary}--`;
    const multipartBody = new Blob([pre, pdfBytes, post]);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartBody,
      },
    );
    const uploaded = await uploadRes.json();
    if (!uploaded.id) throw new Error('Drive upload failed: ' + JSON.stringify(uploaded));

    // Make it viewable by anyone with the link
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });

    const fileUrl: string = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;

    let noteInserted = false;
    if (postToNotes) {
      const { error: noteErr } = await admin.from('notes').insert({
        filename: fileName,
        title: title || safeTitle,
        subject: schedule.subject,
        batch: schedule.batch,
        file_url: fileUrl,
        tags: ['Whiteboard'],
      });
      if (noteErr) {
        // Upload still succeeded — report partial success so the client can
        // surface the link and let the teacher retry the attach.
        return json({ success: true, fileUrl, fileId: uploaded.id, noteInserted: false, noteError: noteErr.message });
      }
      noteInserted = true;
    }

    return json({ success: true, fileUrl, fileId: uploaded.id, noteInserted });
  } catch (e) {
    console.error('upload-whiteboard-pdf error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
