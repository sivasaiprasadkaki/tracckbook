/**
 * Native Google Authentication Service for TrackBook
 * 
 * Supports:
 * 1. Native Android Google Sign-In via Android Credential Manager / Google Play Services
 *    - Opens Google account picker inside the native app (no Chrome browser redirect)
 *    - Retrieves Google ID Token (OIDC JWT)
 *    - Exchanges ID Token with Supabase using supabase.auth.signInWithIdToken()
 * 2. Web Browser Fallback (OAuth redirect) when running in a standard desktop/mobile browser.
 */

import { supabase } from '../lib/supabase';
import { markSessionUnlocked } from './mpinSecurityService';

export interface NativeGoogleAuthResult {
  success: boolean;
  user?: any;
  session?: any;
  error?: string;
  cancelled?: boolean;
}

export interface NativeBridgeGoogleResponse {
  success: boolean;
  idToken?: string;
  nonce?: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  error?: string;
  cancelled?: boolean;
}

declare global {
  interface Window {
    onNativeGoogleSignInResult?: (responseJson: string | NativeBridgeGoogleResponse) => void;
    onNativeGoogleSignInSuccess?: (idToken: string, nonce?: string) => void;
    onNativeGoogleSignInFailure?: (error: string) => void;
  }
}

/**
 * Detect if app is running inside native Android WebView container
 */
export function isNativeAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;

  // Check JavaScript bridge interfaces
  if (
    window.TrackBookAndroid ||
    window.Android ||
    window.AndroidBridge ||
    window.TrackBookNative ||
    (window as any).TrackBookAndroidBridge
  ) {
    return true;
  }

  // Check user agent signature
  const ua = navigator.userAgent || '';
  if (/TrackBookAndroid|TrackBookApp|TrackBookNative|TrackBook\/Android|wv/i.test(ua) && /Android/i.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Check if the Android bridge has native Google Sign-In capability
 */
export async function isNativeGoogleAuthAvailable(): Promise<boolean> {
  if (!isNativeAndroidApp()) return false;

  const bridge =
    window.TrackBookAndroid ||
    window.Android ||
    window.AndroidBridge ||
    window.TrackBookNative;

  if (!bridge) return false;

  if (typeof bridge.signInWithGoogle === 'function') {
    if (typeof bridge.isGoogleAuthSupported === 'function') {
      try {
        const supported = await Promise.resolve(bridge.isGoogleAuthSupported());
        return Boolean(supported);
      } catch {
        return true;
      }
    }
    return true;
  }

  return false;
}

/**
 * Perform Native Google Authentication inside the Android App
 * 
 * 1. Calls Android Credential Manager / Google Sign-In API via Bridge
 * 2. Gets Google ID Token without opening external Chrome browser
 * 3. Authenticates with Supabase via supabase.auth.signInWithIdToken()
 * 4. Initializes local session and unlocks TPIN
 */
export async function performNativeGoogleSignIn(): Promise<NativeGoogleAuthResult> {
  if (!supabase) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  const bridge =
    window.TrackBookAndroid ||
    window.Android ||
    window.AndroidBridge ||
    window.TrackBookNative;

  if (!bridge || typeof bridge.signInWithGoogle !== 'function') {
    return { 
      success: false, 
      error: 'Native Google Sign-In bridge is not available on this device.' 
    };
  }

  return new Promise<NativeGoogleAuthResult>((resolve) => {
    let hasResolved = false;

    const cleanup = () => {
      delete window.onNativeGoogleSignInResult;
      delete window.onNativeGoogleSignInSuccess;
      delete window.onNativeGoogleSignInFailure;
    };

    const finish = (result: NativeGoogleAuthResult) => {
      if (!hasResolved) {
        hasResolved = true;
        cleanup();
        resolve(result);
      }
    };

    // Safety timeout: 45 seconds if user stays on account picker
    const timeoutTimer = setTimeout(() => {
      finish({
        success: false,
        error: 'Google Sign-In request timed out. Please try again.'
      });
    }, 45000);

    // Handler to process the Google ID Token with Supabase
    const handleGoogleIdToken = async (idToken: string, nonce?: string) => {
      clearTimeout(timeoutTimer);
      try {
        if (!idToken || typeof idToken !== 'string') {
          finish({ success: false, error: 'Invalid Google credential token received.' });
          return;
        }

        console.log('[NativeGoogleAuth] Exchanging Google ID Token with Supabase...');

        // Authenticate with Supabase using native Google ID Token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          nonce: nonce || undefined
        });

        if (error) {
          console.error('[NativeGoogleAuth] Supabase signInWithIdToken error:', error);
          finish({ success: false, error: error.message || 'Supabase authentication failed.' });
          return;
        }

        if (data?.session && data?.user) {
          console.log('[NativeGoogleAuth] Successfully signed in user:', data.user.email);
          
          // Mark session unlocked in TPIN manager
          if (data.user.id) {
            markSessionUnlocked(data.user.id);
          }

          // Ensure profile record is synchronized
          try {
            const meta = data.user.user_metadata || {};
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email: data.user.email,
              full_name: meta.full_name || meta.name || data.user.email?.split('@')[0] || 'User',
              avatar_url: meta.avatar_url || meta.picture || null,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          } catch (profileErr) {
            console.warn('[NativeGoogleAuth] Profile sync notice:', profileErr);
          }

          finish({
            success: true,
            user: data.user,
            session: data.session
          });
        } else {
          finish({
            success: false,
            error: 'Authentication failed. No session returned from Supabase.'
          });
        }
      } catch (err: any) {
        console.error('[NativeGoogleAuth] Exception during token exchange:', err);
        finish({
          success: false,
          error: err?.message || 'An error occurred during Google sign-in.'
        });
      }
    };

    // Register global callbacks for Android bridge to call
    window.onNativeGoogleSignInResult = (res: string | NativeBridgeGoogleResponse) => {
      try {
        let parsed: NativeBridgeGoogleResponse;
        if (typeof res === 'string') {
          parsed = JSON.parse(res);
        } else {
          parsed = res;
        }

        if (parsed.cancelled) {
          clearTimeout(timeoutTimer);
          finish({ success: false, cancelled: true, error: 'Google sign-in was cancelled.' });
          return;
        }

        if (!parsed.success || !parsed.idToken) {
          clearTimeout(timeoutTimer);
          finish({
            success: false,
            error: parsed.error || 'Google sign-in was cancelled or failed.'
          });
          return;
        }

        handleGoogleIdToken(parsed.idToken, parsed.nonce);
      } catch (parseErr) {
        console.error('[NativeGoogleAuth] Failed to parse bridge result:', parseErr);
        clearTimeout(timeoutTimer);
        finish({ success: false, error: 'Failed to process Google sign-in response.' });
      }
    };

    window.onNativeGoogleSignInSuccess = (idToken: string, nonce?: string) => {
      handleGoogleIdToken(idToken, nonce);
    };

    window.onNativeGoogleSignInFailure = (error: string) => {
      clearTimeout(timeoutTimer);
      if (error && (error.toLowerCase().includes('cancel') || error.toLowerCase().includes('abort'))) {
        finish({ success: false, cancelled: true, error: 'Google sign-in was cancelled.' });
      } else {
        finish({ success: false, error: error || 'Google sign-in failed.' });
      }
    };

    // Trigger the native bridge
    try {
      console.log('[NativeGoogleAuth] Requesting native Google Sign-In from Android bridge...');
      const bridgeResult = bridge.signInWithGoogle();

      // If bridge returns a Promise directly
      if (bridgeResult && typeof (bridgeResult as any).then === 'function') {
        (bridgeResult as Promise<any>).then((res) => {
          if (res) {
            window.onNativeGoogleSignInResult?.(res);
          }
        }).catch((err) => {
          window.onNativeGoogleSignInFailure?.(err?.message || 'Native bridge error');
        });
      } 
      // If bridge synchronously returns a JSON string result
      else if (typeof bridgeResult === 'string' && bridgeResult.trim().startsWith('{')) {
        window.onNativeGoogleSignInResult?.(bridgeResult);
      }
    } catch (bridgeErr: any) {
      console.error('[NativeGoogleAuth] Error invoking bridge.signInWithGoogle():', bridgeErr);
      clearTimeout(timeoutTimer);
      finish({
        success: false,
        error: bridgeErr?.message || 'Failed to communicate with Android native Google auth.'
      });
    }
  });
}

/**
 * Unified Google Login dispatcher
 * 
 * Checks if running on Android with Native Google Auth support:
 * - If YES -> Uses native Android Google Sign-In (no external browser redirect!)
 * - If NO  -> Uses standard Supabase OAuth Web Flow as fallback
 */
export async function handleUniversalGoogleLogin(options?: {
  redirectTo?: string;
  onStart?: () => void;
  onSuccess?: (session: any) => void;
  onError?: (errorMessage: string) => void;
  onCancelled?: () => void;
}): Promise<void> {
  if (!supabase) {
    options?.onError?.('Supabase is not configured.');
    return;
  }

  options?.onStart?.();

  const isNative = isNativeAndroidApp();
  console.log(`[GoogleAuth] Starting Google login flow. isNativeAndroid: ${isNative}`);

  if (isNative) {
    try {
      const result = await performNativeGoogleSignIn();
      if (result.success && result.session) {
        options?.onSuccess?.(result.session);
        return;
      }

      if (result.cancelled) {
        console.log('[GoogleAuth] Native Google sign-in was cancelled by user.');
        options?.onCancelled?.();
        return;
      }

      options?.onError?.(result.error || 'Native Google Sign-In failed.');
    } catch (nativeErr: any) {
      console.error('[GoogleAuth] Native login error:', nativeErr);
      options?.onError?.(nativeErr?.message || 'Native Google sign-in failed.');
    }
    return;
  }

  // Web Browser Fallback (Standard OAuth Flow)
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://trackbook.xyz';
    const redirectUrl = options?.redirectTo || origin;

    console.log('[GoogleAuth] Fallback to Web OAuth redirect:', redirectUrl);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });

    if (error) {
      throw error;
    }
  } catch (webErr: any) {
    console.error('[GoogleAuth] Web OAuth Sign-In failed:', webErr);
    options?.onError?.(webErr?.message || 'Google Sign-In failed.');
  }
}
