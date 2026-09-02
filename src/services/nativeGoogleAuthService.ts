/**
 * Native Google Authentication Service for TrackBook
 * 
 * Supports:
 * 1. Native Android Google Sign-In via Android Credential Manager / Google Play Services
 *    - Opens Google account picker natively inside the Android app (no Chrome browser redirect)
 *    - Retrieves Google ID Token (OIDC JWT)
 *    - Authenticates directly with Supabase via supabase.auth.signInWithIdToken()
 * 2. Web Browser Fallback (OAuth redirect) when running in a desktop/mobile web browser.
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
 * Retrieve the active Android JavaScript bridge if injected
 */
export function getNativeBridge(): any {
  if (typeof window === 'undefined') return null;

  return (
    window.TrackBookAndroid ||
    window.Android ||
    window.TrackBookNative ||
    window.AndroidBridge ||
    (window as any).TrackBookAndroidBridge ||
    null
  );
}

/**
 * Detect if app is running inside the native Android WebView container
 */
export function isNativeAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Check if bridge is injected
  if (getNativeBridge()) {
    return true;
  }

  // 2. Check user agent signature
  const ua = navigator.userAgent || '';
  if (/TrackBookAndroid|TrackBookApp|TrackBookNative|TrackBook\/Android/i.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Check if the Android bridge has native Google Sign-In capability
 */
export function isNativeGoogleAuthAvailable(): boolean {
  const bridge = getNativeBridge();
  if (!bridge) return false;

  return (
    typeof bridge.signInWithGoogle === 'function' ||
    typeof bridge.nativeGoogleSignIn === 'function'
  );
}

/**
 * Perform Native Google Authentication inside the Android App
 * 
 * 1. Calls Android Credential Manager via Bridge
 * 2. Gets Google ID Token without opening external Chrome browser
 * 3. Authenticates with Supabase via supabase.auth.signInWithIdToken()
 * 4. Initializes local session and unlocks MPIN
 */
export async function performNativeGoogleSignIn(): Promise<NativeGoogleAuthResult> {
  if (!supabase) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  const bridge = getNativeBridge();

  if (!bridge || (!bridge.signInWithGoogle && !bridge.nativeGoogleSignIn)) {
    return { 
      success: false, 
      error: 'Native Google Sign-In bridge is not available on this device.' 
    };
  }

  return new Promise<NativeGoogleAuthResult>((resolve) => {
    let hasResolved = false;

    const cleanup = () => {
      try {
        delete window.onNativeGoogleSignInResult;
        delete window.onNativeGoogleSignInSuccess;
        delete window.onNativeGoogleSignInFailure;
      } catch (e) {
        // ignore
      }
    };

    const finish = (result: NativeGoogleAuthResult) => {
      if (!hasResolved) {
        hasResolved = true;
        cleanup();
        resolve(result);
      }
    };

    // Timeout: 60 seconds for user account selection
    const timeoutTimer = setTimeout(() => {
      finish({
        success: false,
        error: 'Google Sign-In request timed out. Please try again.'
      });
    }, 60000);

    // Handler to process the Google ID Token with Supabase
    const handleGoogleIdToken = async (idToken: string, nonce?: string) => {
      clearTimeout(timeoutTimer);
      try {
        if (!idToken || typeof idToken !== 'string') {
          finish({ success: false, error: 'Invalid Google credential token received.' });
          return;
        }

        console.log('[NativeGoogleAuth] Authenticating Google ID Token with Supabase...');

        // 1. Authenticate with Supabase using native Google ID Token
        let { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          nonce: nonce || undefined
        });

        // If error might be nonce related, retry once without nonce
        if (error && nonce && (error.message?.toLowerCase().includes('nonce') || error.message?.toLowerCase().includes('token'))) {
          console.warn('[NativeGoogleAuth] Retrying signInWithIdToken without nonce parameter...');
          const retry = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken
          });
          if (!retry.error) {
            data = retry.data;
            error = null;
          }
        }

        if (error) {
          console.error('[NativeGoogleAuth] Supabase signInWithIdToken error:', error);
          finish({ success: false, error: error.message || 'Supabase authentication failed.' });
          return;
        }

        if (data?.session && data?.user) {
          console.log('[NativeGoogleAuth] Successfully signed in user:', data.user.email);
          
          // Mark session unlocked in MPIN manager
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
      
      const invokeBridge = bridge.signInWithGoogle || bridge.nativeGoogleSignIn;
      const bridgeResult = typeof invokeBridge === 'function' ? invokeBridge.call(bridge) : null;

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
      console.error('[NativeGoogleAuth] Error invoking bridge:', bridgeErr);
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
 * - If NO / Fallback -> Uses standard Supabase OAuth Web Flow
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

  const isNativeAuthAvailable = isNativeGoogleAuthAvailable();
  console.log(`[GoogleAuth] Starting Google login flow. isNativeAuthAvailable: ${isNativeAuthAvailable}`);

  if (isNativeAuthAvailable) {
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

      // If there's an error from native auth
      console.warn('[GoogleAuth] Native Google Sign-In returned error:', result.error);
      options?.onError?.(result.error || 'Google sign-in could not be completed.');
      return;
    } catch (nativeErr: any) {
      console.error('[GoogleAuth] Native login exception:', nativeErr);
      options?.onError?.(nativeErr?.message || 'Native Google sign-in failed.');
      return;
    }
  }

  // Web Browser Fallback (Standard Supabase OAuth Flow)
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://trackbook.xyz';
    const redirectUrl = options?.redirectTo || origin;

    console.log('[GoogleAuth] Starting Web OAuth redirect:', redirectUrl);
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
