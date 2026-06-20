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

// Cloudinary creds are project-wide edge secrets (also used by cloudinary-sign).
const CLOUDINARY_CLOUD = Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? 'drrits4mq';
const CLOUDINARY_KEY = Deno.env.get('CLOUDINARY_API_KEY') ?? '819424178256119';
const CLOUDINARY_SECRET = Deno.env.get('CLOUDINARY_API_SECRET') ?? '';

async function sha1Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Fetch the PDF the browser uploaded to Cloudinary (server-to-server, fast).
// Retries briefly in case it's still propagating; validates the %PDF header.
async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`fetch pdf HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
        throw new Error('fetched file is not a PDF');
      }
      return bytes;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw new Error('Could not fetch uploaded PDF: ' + (lastErr instanceof Error ? lastErr.message : String(lastErr)));
}

// Best-effort delete of the temp Cloudinary raw object once Drive has the file.
async function deleteCloudinaryRaw(publicId: string): Promise<void> {
  if (!CLOUDINARY_SECRET || !publicId) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sha1Hex(`public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_SECRET}`);
  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', CLOUDINARY_KEY);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/destroy`, { method: 'POST', body: form });
}

type BatchSubjectPair = {
  batch: string;
  subject: string;
};

function uniquePairs(pairs: BatchSubjectPair[]): BatchSubjectPair[] {
  const seen = new Set<string>();
  return pairs.filter((pair) => {
    const key = `${pair.batch}|${pair.subject}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getActiveMergePairs(
  admin: any,
  batch: string,
  subject: string,
): Promise<BatchSubjectPair[]> {
  const fallback = [{ batch, subject }];
  const { data, error } = await admin.rpc('get_merged_pairs', {
    p_batch: batch,
    p_subject: subject,
  });

  if (error || !Array.isArray(data)) {
    if (error) console.error('get_merged_pairs failed:', error);
    return fallback;
  }

  const pairs = uniquePairs(
    data
      .map((pair: Record<string, unknown>) => ({
        batch: typeof pair.batch === 'string' ? pair.batch : '',
        subject: typeof pair.subject === 'string' ? pair.subject : '',
      }))
      .filter((pair: BatchSubjectPair) => pair.batch && pair.subject),
  );

  return pairs.length > 0 ? pairs : fallback;
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

    const { scheduleId, title, pdfBase64, pdfUrl, pdfPublicId, postToNotes = true } = await req.json();
    if (!scheduleId || (!pdfBase64 && !pdfUrl)) return json({ error: 'Missing scheduleId or pdf' }, 400);

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

    // Also allow whoever actually TAUGHT this class (recorded as a teacher in
    // class_attendance), so a co-teacher who took the session isn't falsely
    // blocked from saving its notes.
    let taughtThisClass = false;
    if (!teacherAllowed && !isAdmin) {
      const { data: att } = await admin
        .from('class_attendance')
        .select('id')
        .eq('schedule_id', scheduleId)
        .eq('user_id', user.id)
        .eq('user_role', 'teacher')
        .limit(1)
        .maybeSingle();
      taughtThisClass = att != null;
    }

    if (!teacherAllowed && !isAdmin && !taughtThisClass) {
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

    // Get the PDF bytes: fetch from Cloudinary (the fast new path) or decode the
    // legacy base64 body (back-compat for any cached old client).
    const pdfBytes = pdfUrl ? await fetchPdfBytes(pdfUrl) : base64ToBytes(pdfBase64);
    const boundary = '----whiteboard' + crypto.randomUUID();
    const metadata = JSON.stringify({ name: fileName, parents: [subjectId] });
    const pre =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/pdf\r\n\r\n';
    const post = `\r\n--${boundary}--`;
    const pdfPart = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    ) as ArrayBuffer;
    const multipartBody = new Blob([pre, pdfPart, post]);

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

    // Google Drive now owns the PDF — drop the Cloudinary transit copy (best-effort).
    if (pdfPublicId) {
      try { await deleteCloudinaryRaw(pdfPublicId); } catch (e) { console.error('temp cleanup failed:', e); }
    }

    let noteInserted = false;
    let noteInsertCount = 0;
    if (postToNotes) {
      const notePairs = await getActiveMergePairs(admin, schedule.batch, schedule.subject);
      const noteRows = notePairs.map((pair) => ({
        filename: fileName,
        title: title || safeTitle,
        subject: pair.subject,
        batch: pair.batch,
        file_url: fileUrl,
        tags: ['Whiteboard'],
      }));

      const { error: noteErr } = await admin.from('notes').insert(noteRows);
      if (noteErr) {
        // Upload still succeeded — report partial success so the client can
        // surface the link and let the teacher retry the attach.
        return json({ success: true, fileUrl, fileId: uploaded.id, noteInserted: false, noteInsertCount, noteError: noteErr.message });
      }
      noteInserted = true;
      noteInsertCount = noteRows.length;
    }

    // The notes are saved — drop this class's editable recovery snapshot
    // (the permanent record is now the PDF in Drive). Best-effort.
    try { await deleteCloudinaryRaw(`class_wb/${scheduleId}.txt`); } catch (e) { console.error('class snapshot cleanup failed:', e); }

    return json({ success: true, fileUrl, fileId: uploaded.id, noteInserted, noteInsertCount });
  } catch (e) {
    console.error('upload-whiteboard-pdf error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
