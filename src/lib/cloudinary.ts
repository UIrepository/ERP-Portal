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

/**
 * Upload an arbitrary blob to Cloudinary and return its URL + public_id.
 * Used by the general whiteboard to store a tldraw snapshot (resourceType
 * 'raw') and its thumbnail ('image'). The signature only covers folder +
 * timestamp, so the same signed request works for either resource type.
 */
export async function uploadBlobToCloudinary(
  blob: Blob,
  opts: { folder: string; resourceType?: 'image' | 'raw'; fileName?: string },
): Promise<{ url: string; publicId: string }> {
  const { folder, resourceType = 'raw', fileName } = opts;
  const { data, error } = await supabase.functions.invoke('cloudinary-sign', { body: { folder } });
  if (error || !data) throw new Error('Could not sign upload');

  const { signature, timestamp, api_key, cloud_name } = data as {
    signature: string;
    timestamp: number;
    api_key: string;
    cloud_name: string;
  };

  const form = new FormData();
  form.append('file', blob, fileName);
  form.append('api_key', api_key);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Cloudinary upload failed');
  const json = await res.json();
  return { url: json.secure_url as string, publicId: json.public_id as string };
}
