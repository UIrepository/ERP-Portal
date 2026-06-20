import { supabase } from '@/integrations/supabase/client';

/** Downscale + compress an image in the browser before upload (saves bandwidth). */
async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Upload an image straight to Cloudinary (bypasses Supabase Storage egress).
 * A Supabase edge function signs the request; the API secret never reaches the browser.
 * Returns the hosted secure URL.
 */
export async function uploadImageToCloudinary(file: File, folder = 'chat_uploads'): Promise<string> {
  const { data, error } = await supabase.functions.invoke('cloudinary-sign', { body: { folder } });
  if (error || !data) throw new Error('Could not sign upload');

  const { signature, timestamp, api_key, cloud_name } = data as {
    signature: string;
    timestamp: number;
    api_key: string;
    cloud_name: string;
  };

  const blob = await compressImage(file);
  const form = new FormData();
  form.append('file', blob);
  form.append('api_key', api_key);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Cloudinary upload failed');
  const json = await res.json();
  return json.secure_url as string;
}

// Cloudinary cloud name (public). Used to build deterministic raw delivery URLs.
export const CLOUDINARY_CLOUD = 'drrits4mq';

/**
 * Upload an arbitrary blob to Cloudinary and return its URL + public_id.
 * Used by the whiteboard to store tldraw snapshots ('raw') and thumbnails
 * ('image'). Pass a fixed `publicId` + `overwrite` to deterministically
 * overwrite one object (e.g. a class whiteboard's recovery snapshot — no
 * orphans). The edge function signs exactly the params it returns.
 */
export async function uploadBlobToCloudinary(
  blob: Blob,
  opts: {
    folder?: string;
    resourceType?: 'image' | 'raw';
    fileName?: string;
    publicId?: string;
    overwrite?: boolean;
    invalidate?: boolean;
  },
): Promise<{ url: string; publicId: string }> {
  const { folder, resourceType = 'raw', fileName, publicId, overwrite, invalidate } = opts;
  const signBody: Record<string, unknown> = {};
  if (folder) signBody.folder = folder;
  if (publicId) signBody.public_id = publicId;
  if (overwrite) signBody.overwrite = true;
  if (invalidate) signBody.invalidate = true;

  const { data, error } = await supabase.functions.invoke('cloudinary-sign', { body: signBody });
  if (error || !data) throw new Error('Could not sign upload');

  const { signature, api_key, cloud_name, params } = data as {
    signature: string;
    api_key: string;
    cloud_name: string;
    params: Record<string, string>;
  };

  const form = new FormData();
  form.append('file', blob, fileName);
  form.append('api_key', api_key);
  form.append('signature', signature);
  // Append exactly the params the function signed (timestamp + folder/public_id/...).
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Cloudinary upload failed');
  const json = await res.json();
  return { url: json.secure_url as string, publicId: json.public_id as string };
}
