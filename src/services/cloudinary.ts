import { supabase } from '../lib/supabase';

/**
 * Cloudinary Upload Service for Expense/Cashbook Images
 */

export async function getUserCloudinaryFolder(user?: { email?: string | null; id: string } | null): Promise<string> {
  let resolvedUser = user;
  if (!resolvedUser && supabase) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      resolvedUser = data.session.user;
    }
  }

  if (resolvedUser) {
    const identifier = resolvedUser.email || resolvedUser.id;
    return `trackbook/${identifier}`;
  }

  throw new Error("No authenticated user found for Cloudinary folder generation.");
}

export async function uploadToCloudinary(
  fileDataUriOrFile: string | File, 
  folder?: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dd2kcpetc';
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'trackbook_preset';

  console.log(`[Cloudinary] Beginning upload process configured for:`, {
    cloudName,
    uploadPreset,
    isString: typeof fileDataUriOrFile === 'string',
    folder,
  });

  const formData = new FormData();
  formData.append('file', fileDataUriOrFile);
  formData.append('upload_preset', uploadPreset);
  if (folder) {
    formData.append('folder', folder);
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  console.log(`[Cloudinary] Posting request to: ${url}`);

  // Use XMLHttpRequest when available to get real-time upload progress events
  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.secure_url) {
              if (onProgress) onProgress(100);
              console.log('[Cloudinary] Successfully uploaded image:', data.secure_url);
              resolve(data.secure_url);
            } else {
              reject(new Error('Cloudinary response did not contain a valid secure_url field'));
            }
          } catch (e: any) {
            reject(new Error('Failed to parse Cloudinary response: ' + e.message));
          }
        } else {
          console.error(`[Cloudinary] API Error Response [${xhr.status}]:`, xhr.responseText);
          reject(new Error(`Cloudinary upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload to TrackBook Cloud. Please check your connection.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload to TrackBook Cloud timed out. Please try again.'));
      };

      xhr.send(formData);
    });
  }

  // Fallback to fetch if XMLHttpRequest is unavailable
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Cloudinary] API Error Response [${response.status}]:`, errorText);
      throw new Error(`Cloudinary upload failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!data.secure_url) {
      throw new Error('Cloudinary response did not contain a valid secure_url field');
    }

    if (onProgress) onProgress(100);
    return data.secure_url;
  } catch (error: any) {
    console.error('[Cloudinary] Failure in uploadToCloudinary catch block:', error);
    throw error;
  }
}

/**
 * Optimizes Cloudinary delivery URLs for ultra-low bandwidth usage
 * Also proxies any non-Cloudinary images through Cloudinary Fetch to protect Supabase egress
 */
export function getOptimizedCloudinaryUrl(url: string, type: 'preview' | 'fullscreen'): string {
  if (!url || typeof url !== 'string') return '';
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dd2kcpetc';
  const transformation = type === 'preview' ? 'f_auto,q_auto,w_300' : 'f_auto,q_auto,w_1200';

  if (!url.includes('cloudinary.com')) {
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    // Egress protection: proxy non-Cloudinary images through Cloudinary image/fetch API
    return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformation}/${encodeURIComponent(url)}`;
  }

  if (url.includes('/image/upload/')) {
    const parts = url.split('/image/upload/');
    const remaining = parts[1];
    if (!remaining) return url;
    
    const folderAndFile = remaining.split('/');
    const cleanSegments = folderAndFile.filter(s => {
      return !(s.includes('w_') || s.includes('q_') || s.includes('f_') || s.includes('c_') || s.includes('h_') || s.includes('dpr_'));
    });
    
    return `${parts[0]}/image/upload/${transformation}/${cleanSegments.join('/')}`;
  }
  
  return url;
}

/**
 * Pre-generate lightweight export URLs by stripping transformations and applying lightweight export-specific transforms
 * Also proxies any non-Cloudinary images through Cloudinary Fetch
 */
export function getExportOptimizedCloudinaryUrl(url: string, isCompressed: boolean, isHuge: boolean): string {
  if (!url || typeof url !== 'string') return '';
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dd2kcpetc';

  let transformation = '';
  if (isCompressed) {
    if (isHuge) {
      transformation = 'f_jpg,q_35,w_800';
    } else {
      transformation = 'f_jpg,q_40,w_900';
    }
  } else {
    // Original quality mode preservation
    transformation = 'f_jpg,q_82';
  }

  if (!url.includes('cloudinary.com')) {
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    // Egress protection: proxy non-Cloudinary images through Cloudinary image/fetch API
    return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformation}/${encodeURIComponent(url)}`;
  }

  // Support both /image/upload/ and /upload/ formats
  const splitter = url.includes('/image/upload/') ? '/image/upload/' : '/upload/';
  const parts = url.split(splitter);
  const remaining = parts[1];
  if (!remaining) return url;
  
  const folderAndFile = remaining.split('/');
  const cleanSegments = folderAndFile.filter(s => {
    return !(
      s.includes('w_') || 
      s.includes('q_') || 
      s.includes('f_') || 
      s.includes('c_') || 
      s.includes('h_') || 
      s.includes('dpr_') || 
      s.includes('auto')
    );
  });
  
  return `${parts[0]}${splitter}${transformation}/${cleanSegments.join('/')}`;
}
