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
          if (
            key &&
            (key.startsWith('sb-') ||
             key.endsWith('-auth-token') ||
             key.includes('auth-token') ||
             key === 'trackbook_cached_auth_session' ||
             key === 'trackbook_cached_books' ||
             key === 'trackbook_avatar' ||
             key === 'trackbook_offline_auth' ||
             key.startsWith('tb_auth_unlocked_'))
          ) {
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

export interface LogoutOptions {
  reason?: 'user' | 'inactivity' | 'blocked' | 'expired' | string;
  redirectUrl?: string;
}

export const executeAppLogout = async (options: LogoutOptions = {}): Promise<void> => {
  const reason = options.reason || 'user';
  const redirectUrl = options.redirectUrl || '/login';

  console.log(`[TrackBook Auth] Executing complete logout (reason: ${reason})...`);

  // 1. Mark explicit logout flag in localStorage so session rehydration is prevented
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('trackbook_explicit_logout', 'true');
      localStorage.removeItem('trackbook_last_activity_ts');
      localStorage.removeItem('trackbook_cached_books');
      localStorage.removeItem('trackbook_cached_auth_session');
      localStorage.removeItem('trackbook_avatar');
      localStorage.removeItem('trackbook_offline_auth');
      localStorage.removeItem('supabase_remember_me');
      localStorage.removeItem('trackbook_force_tpin');
    }
  } catch (e) {
    console.warn('[TrackBook Auth] Error cleaning localStorage:', e);
  }

  // 2. Clear unlocked TPIN state & set logout reason in sessionStorage
  try {
    if (typeof sessionStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && (k.startsWith('tb_auth_unlocked_') || k === 'tb_fresh_login_session' || k.startsWith('sb-') || k.endsWith('-auth-token'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => {
        try { sessionStorage.removeItem(k); } catch {}
      });

      if (reason === 'inactivity') {
        sessionStorage.setItem('logout_reason', 'inactivity');
      } else if (reason === 'blocked') {
        sessionStorage.setItem('auth_blocked_notice', 'User blocked');
      } else {
        sessionStorage.removeItem('logout_reason');
      }
    }
  } catch (e) {}

  // 3. Clear all Supabase auth storage tokens
  clearSupabaseAuthStorage();

  // 4. Safely call supabase.auth.signOut() with a strict timeout race so it never hangs
  try {
    if (supabase?.auth) {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
    }
  } catch (err) {
    console.warn('[TrackBook Auth] Supabase signOut note:', err);
  }

  // 5. Broadcast global logout event
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trackbook:logout', { detail: { reason } }));
    }
  } catch (e) {}

  // 6. Hard redirect to target URL
  if (typeof window !== 'undefined') {
    if (window.location.pathname === redirectUrl) {
      window.location.reload();
    } else {
      window.location.replace(redirectUrl);
    }
  }
};


