/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://chbbaswtawmbmyquoiac.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoYmJhc3d0YXdtYm15cXVvaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MTcsImV4cCI6MjA5MDY5NzkxN30.4qNJG7rjpEJ9vfyiGy_mteUI9_X1I6dNekEuXV26Xic';

const isConfigured = (url: string | undefined, key: string | undefined) => {
  if (!url || !key) return false;
  if (url === 'your_supabase_url' || key === 'your_supabase_anon_key') return false;
  return true;
};

export const clearSupabaseAuthStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      const clearFrom = (storage: Storage) => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && (key.startsWith('sb-') || key.endsWith('-auth-token') || key === 'trackbook_cached_auth_session')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => {
          try {
            storage.removeItem(k);
            console.warn(`[Supabase Safety] Cleaned up session key: ${k}`);
          } catch {}
        });
      };
      if (window.localStorage) clearFrom(window.localStorage);
      if (window.sessionStorage) clearFrom(window.sessionStorage);
    } catch (e) {
      console.warn('[Supabase Safety] Note while clearing storage:', e);
    }
  }
};

export const isMobileDeviceOrView = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isSmallScreen = window.innerWidth < 1024;
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
  const hasTouch = 'ontouchstart' in window || ((navigator.maxTouchPoints || 0) > 0);
  return isSmallScreen || isMobileUA || hasTouch;
};

const dynamicStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    // On mobile view / mobile devices, always persist to localStorage so user is never logged out
    if (isMobileDeviceOrView()) {
      return localStorage.getItem(key);
    }
    const rememberMe = localStorage.getItem('supabase_remember_me') !== 'false';
    const val = rememberMe ? localStorage.getItem(key) : sessionStorage.getItem(key);
    return val;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    // On mobile view / mobile devices, always persist to localStorage so user stays logged in indefinitely
    if (isMobileDeviceOrView()) {
      localStorage.setItem(key, value);
      localStorage.setItem('supabase_remember_me', 'true');
      return;
    }
    const rememberMe = localStorage.getItem('supabase_remember_me') !== 'false';
    if (rememberMe) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
    if (key.startsWith('sb-') || key.endsWith('-auth-token')) {
      try {
        localStorage.setItem('trackbook_cached_auth_session', value);
      } catch {}
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    if (key.startsWith('sb-') || key.endsWith('-auth-token')) {
      try {
        localStorage.removeItem('trackbook_cached_auth_session');
      } catch {}
    }
  }
};

export const getCachedLocalSession = (): any => {
  if (typeof window === 'undefined') return null;
  try {
    const direct = localStorage.getItem('trackbook_cached_auth_session');
    if (direct) {
      const parsed = JSON.parse(direct);
      if (parsed && (parsed.user || parsed.access_token)) {
        return parsed;
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.endsWith('-auth-token'))) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.user || parsed.access_token)) {
            return parsed;
          }
        }
      }
    }

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('sb-') || key.endsWith('-auth-token'))) {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.user || parsed.access_token)) {
            return parsed;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Supabase Auth Safety] Error reading cached local session:', e);
  }
  return null;
};

const createWrappedSupabaseClient = () => {
  if (!isConfigured(supabaseUrl, supabaseAnonKey)) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: typeof window !== 'undefined' ? dynamicStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  // Wrap getSession to handle refresh token invalidation, preserve offline sessions, and prevent crashes
  const originalGetSession = client.auth.getSession.bind(client.auth);
  client.auth.getSession = async () => {
    try {
      const res = await originalGetSession();
      if (res?.error) {
        const errMsg = res.error.message || '';
        if (
          errMsg.includes('Invalid Refresh Token') || 
          errMsg.includes('Refresh Token Not Found') ||
          errMsg.includes('invalid_grant') ||
          errMsg.includes('Refresh token')
        ) {
          console.warn('[Supabase Auth Safety] Invalid refresh token detected from getSession, auto-clearing corrupt local storage.');
          clearSupabaseAuthStorage();
          res.data = { session: null };
          return res;
        }

        // If error is network or offline, restore cached session rather than failing
        const isOfflineOrNetwork = (typeof navigator !== 'undefined' && !navigator.onLine) ||
          errMsg.toLowerCase().includes('failed to fetch') ||
          errMsg.toLowerCase().includes('network') ||
          errMsg.toLowerCase().includes('abort');

        if (isOfflineOrNetwork) {
          const cached = getCachedLocalSession();
          if (cached) {
            console.log('[Supabase Auth Safety] Offline/network error during getSession. Preserving local cached session.');
            return { data: { session: cached }, error: null };
          }
        }
      }

      // If res.data.session is null but device is offline, check local cache
      if (!res?.data?.session && typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = getCachedLocalSession();
        if (cached) {
          console.log('[Supabase Auth Safety] Device is offline with empty getSession. Returning local cached session.');
          return { data: { session: cached }, error: null };
        }
      }

      return res;
    } catch (err: any) {
      console.warn('[Supabase Auth Safety] getSession exception:', err?.message || err);
      const errMsg = err?.message || '';
      if (
        errMsg.includes('Invalid Refresh Token') || 
        errMsg.includes('Refresh Token Not Found') ||
        errMsg.includes('invalid_grant') ||
        errMsg.includes('Refresh token')
      ) {
        clearSupabaseAuthStorage();
        return { data: { session: null }, error: err };
      }

      // If offline / network error thrown, fall back to cached session
      const isOfflineOrNetwork = (typeof navigator !== 'undefined' && !navigator.onLine) ||
        errMsg.toLowerCase().includes('failed to fetch') ||
        errMsg.toLowerCase().includes('network') ||
        errMsg.toLowerCase().includes('abort');

      if (isOfflineOrNetwork) {
        const cached = getCachedLocalSession();
        if (cached) {
          console.log('[Supabase Auth Safety] Restored cached session after getSession network exception.');
          return { data: { session: cached }, error: null };
        }
      }

      return { data: { session: null }, error: err };
    }
  };

  // Wrap refreshSession to gracefully catch 'Invalid Refresh Token: Refresh Token Not Found' and network errors
  const originalRefreshSession = client.auth.refreshSession.bind(client.auth);
  client.auth.refreshSession = async (currentSession?: any) => {
    try {
      const res = await originalRefreshSession(currentSession);
      if (res?.error) {
        const errMsg = res.error.message || '';
        if (
          errMsg.includes('Invalid Refresh Token') || 
          errMsg.includes('Refresh Token Not Found') ||
          errMsg.includes('invalid_grant') ||
          errMsg.includes('Refresh token')
        ) {
          console.warn('[Supabase Auth Safety] Invalid refresh token detected in refreshSession, clearing stale storage.');
          clearSupabaseAuthStorage();
          return { data: { session: null, user: null }, error: null };
        }

        const isOfflineOrNetwork = (typeof navigator !== 'undefined' && !navigator.onLine) ||
          errMsg.toLowerCase().includes('failed to fetch') ||
          errMsg.toLowerCase().includes('network') ||
          errMsg.toLowerCase().includes('abort');

        if (isOfflineOrNetwork) {
          const cached = getCachedLocalSession();
          if (cached) {
            console.log('[Supabase Auth Safety] Network error in refreshSession, preserving cached session.');
            return { data: { session: cached, user: cached.user || null }, error: null };
          }
        }
      }
      return res;
    } catch (err: any) {
      console.warn('[Supabase Auth Safety] refreshSession exception:', err?.message || err);
      const errMsg = err?.message || '';
      if (
        errMsg.includes('Invalid Refresh Token') || 
        errMsg.includes('Refresh Token Not Found') ||
        errMsg.includes('invalid_grant') ||
        errMsg.includes('Refresh token')
      ) {
        clearSupabaseAuthStorage();
        return { data: { session: null, user: null }, error: null };
      }

      const isOfflineOrNetwork = (typeof navigator !== 'undefined' && !navigator.onLine) ||
        errMsg.toLowerCase().includes('failed to fetch') ||
        errMsg.toLowerCase().includes('network') ||
        errMsg.toLowerCase().includes('abort');

      if (isOfflineOrNetwork) {
        const cached = getCachedLocalSession();
        if (cached) {
          return { data: { session: cached, user: cached.user || null }, error: null };
        }
      }

      return { data: { session: null, user: null }, error: null };
    }
  };

  // Wrap getUser to prevent unhandled rejection on network drop or invalid token
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (jwt?: string) => {
    try {
      const res = await originalGetUser(jwt);
      if (res?.error) {
        const errMsg = res.error.message || '';
        if (
          errMsg.includes('Invalid Refresh Token') || 
          errMsg.includes('Refresh Token Not Found') ||
          errMsg.includes('invalid_grant') ||
          errMsg.includes('Refresh token')
        ) {
          clearSupabaseAuthStorage();
          return { data: { user: null }, error: null };
        }

        const isOfflineOrNetwork = (typeof navigator !== 'undefined' && !navigator.onLine) ||
          errMsg.toLowerCase().includes('failed to fetch') ||
          errMsg.toLowerCase().includes('network') ||
          errMsg.toLowerCase().includes('abort');

        if (isOfflineOrNetwork) {
          const cached = getCachedLocalSession();
          if (cached?.user) {
            return { data: { user: cached.user }, error: null };
          }
        }
      }
      return res;
    } catch (err: any) {
      console.warn('[Supabase Auth Safety] getUser exception:', err?.message || err);
      const errMsg = err?.message || '';
      if (
        errMsg.includes('Invalid Refresh Token') || 
        errMsg.includes('Refresh Token Not Found') ||
        errMsg.includes('invalid_grant') ||
        errMsg.includes('Refresh token')
      ) {
        clearSupabaseAuthStorage();
        return { data: { user: null }, error: null };
      }

      const isOfflineOrNetwork = (typeof navigator !== 'undefined' && !navigator.onLine) ||
        errMsg.toLowerCase().includes('failed to fetch') ||
        errMsg.toLowerCase().includes('network') ||
        errMsg.toLowerCase().includes('abort');

      if (isOfflineOrNetwork) {
        const cached = getCachedLocalSession();
        if (cached?.user) {
          return { data: { user: cached.user }, error: null };
        }
      }

      return { data: { user: null }, error: null };
    }
  };

  return client;
};

export const supabase = createWrappedSupabaseClient();

if (!supabase) {
  console.warn('Supabase configuration missing or using placeholders:', {
    url: supabaseUrl ? (supabaseUrl === 'your_supabase_url' ? 'Placeholder' : 'Present') : 'Missing',
    key: supabaseAnonKey ? (supabaseAnonKey === 'your_supabase_anon_key' ? 'Placeholder' : 'Present') : 'Missing'
  });
}

