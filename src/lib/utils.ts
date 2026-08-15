import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function vibrate(pattern: number | number[] = 50) {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    // Only vibrate on mobile devices (simple check)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.navigator.vibrate(pattern);
    }
  }
}

export interface SafeJsonResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  rawText: string;
  isJson: boolean;
  error?: string;
}

export async function safeParseResponse<T = any>(response: Response): Promise<SafeJsonResponse<T>> {
  const status = response.status;
  const ok = response.ok;
  let rawText = '';
  try {
    rawText = await response.text();
  } catch {
    rawText = '';
  }

  let data: T | null = null;
  let isJson = false;

  if (rawText && rawText.trim()) {
    try {
      const trimmed = rawText.trim();
      const contentType = response.headers?.get('content-type') || '';
      if (contentType.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
        data = JSON.parse(trimmed);
        isJson = true;
      }
    } catch {
      data = null;
      isJson = false;
    }
  }

  let error: string | undefined;
  if (!ok || (data && (data as any).success === false)) {
    if (data && typeof data === 'object') {
      error = (data as any).error || (data as any).message || (data as any).details;
    } else if (rawText && !rawText.includes('<html') && rawText.length < 200) {
      error = rawText;
    } else {
      error = `Request failed with status ${status}`;
    }
  }

  return {
    ok,
    status,
    data,
    rawText,
    isJson,
    error
  };
}
