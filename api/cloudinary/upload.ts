import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, upload_preset, folder } = req.body || {};
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME || 'dd2kcpetc';
    const preset = upload_preset || process.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'trackbook_preset';

    const payload: any = {
      file,
      upload_preset: preset
    };
    if (folder) {
      payload.folder = folder;
    }

    const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!cloudinaryRes.ok) {
      const errText = await cloudinaryRes.text();
      return res.status(cloudinaryRes.status).json({ error: errText });
    }

    const data = await cloudinaryRes.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.warn('[Cloudinary Proxy] Upload proxy error:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Server error uploading to Cloudinary' });
  }
}
