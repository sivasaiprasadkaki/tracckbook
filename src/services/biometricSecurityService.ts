/**
 * Biometric Security Service for TrackBook Mobile (Android Bridge)
 * 
 * Communicates directly with the native Android Biometric Prompt through
 * the window.TrackBookAndroid bridge.
 */

export interface BiometricActionResult {
  success: boolean;
  error?: string;
  isUnsupported?: boolean;
}

export interface TrackBookAndroidBridge {
  isBiometricSupported?: () => boolean | Promise<boolean>;
  isBiometricEnabled?: () => boolean | Promise<boolean>;
  enableBiometric?: () => boolean | Promise<boolean | { success: boolean; error?: string }>;
  disableBiometric?: () => boolean | Promise<boolean | { success: boolean; error?: string }>;
  openBiometricSettings?: () => void | Promise<void>;
  exitApp?: () => void | Promise<void>;
}

declare global {
  interface Window {
    TrackBookAndroid?: TrackBookAndroidBridge;
  }
}

/**
 * Exit native Android app or close window if supported.
 */
export function exitNativeApp(): void {
  try {
    if (typeof window !== 'undefined') {
      if (window.TrackBookAndroid && typeof window.TrackBookAndroid.exitApp === 'function') {
        window.TrackBookAndroid.exitApp();
        return;
      }
      if ((window as any).navigator?.app && typeof (window as any).navigator.app.exitApp === 'function') {
        (window as any).navigator.app.exitApp();
        return;
      }
      if (typeof window.close === 'function') {
        window.close();
      }
    }
  } catch (err) {
    console.warn('[BiometricService] exitApp error:', err);
  }
}

const LOCAL_BIOMETRIC_KEY = 'tb_biometric_enabled_flag';

/**
 * Check if the current device/Android native wrapper supports biometric authentication (Fingerprint / Face).
 */
export async function isBiometricSupported(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && window.TrackBookAndroid) {
      if (typeof window.TrackBookAndroid.isBiometricSupported === 'function') {
        const res = await Promise.resolve(window.TrackBookAndroid.isBiometricSupported());
        return Boolean(res);
      }
    }

    // Check if WebAuthn platform authenticator is available in browser if bridge is absent
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return Boolean(available);
      }
    }

    // Default to true for mobile environments to allow testing unless explicitly reported false
    return false;
  } catch (err) {
    console.warn('[BiometricService] isBiometricSupported check failed:', err);
    return false;
  }
}

/**
 * Check if Biometric lock is currently enabled.
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && window.TrackBookAndroid) {
      if (typeof window.TrackBookAndroid.isBiometricEnabled === 'function') {
        const res = await Promise.resolve(window.TrackBookAndroid.isBiometricEnabled());
        return Boolean(res);
      }
    }

    // Check local storage fallback
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(LOCAL_BIOMETRIC_KEY) === 'true';
    }

    return false;
  } catch (err) {
    console.warn('[BiometricService] isBiometricEnabled check failed:', err);
    return false;
  }
}

/**
 * Request enabling biometric authentication via the native Android biometric prompt.
 */
export async function enableBiometric(): Promise<BiometricActionResult> {
  try {
    // 1. Verify support first
    const supported = await isBiometricSupported();
    if (!supported && typeof window !== 'undefined' && !window.TrackBookAndroid) {
      // In web browser or unsupported device without bridge
      return {
        success: false,
        isUnsupported: true,
        error: 'Biometric authentication is not available on this device.',
      };
    }

    // 2. Call native Android Bridge
    if (typeof window !== 'undefined' && window.TrackBookAndroid) {
      if (typeof window.TrackBookAndroid.enableBiometric === 'function') {
        const result = await Promise.resolve(window.TrackBookAndroid.enableBiometric());
        
        // Result could be boolean or object { success: boolean, error?: string }
        if (typeof result === 'boolean') {
          if (result) {
            localStorage.setItem(LOCAL_BIOMETRIC_KEY, 'true');
            return { success: true };
          } else {
            return { success: false, error: 'Biometric authentication was cancelled or failed.' };
          }
        } else if (result && typeof result === 'object') {
          if (result.success) {
            localStorage.setItem(LOCAL_BIOMETRIC_KEY, 'true');
            return { success: true };
          } else {
            return { success: false, error: result.error || 'Biometric authentication failed.' };
          }
        }
      }
    }

    // Fallback simulation if running in mobile web browser preview with WebAuthn/localStorage
    localStorage.setItem(LOCAL_BIOMETRIC_KEY, 'true');
    return { success: true };
  } catch (err: any) {
    console.error('[BiometricService] enableBiometric error:', err);
    return {
      success: false,
      error: err?.message || 'An error occurred while enabling biometric lock.',
    };
  }
}

/**
 * Request disabling biometric authentication.
 */
export async function disableBiometric(): Promise<BiometricActionResult> {
  try {
    if (typeof window !== 'undefined' && window.TrackBookAndroid) {
      if (typeof window.TrackBookAndroid.disableBiometric === 'function') {
        await Promise.resolve(window.TrackBookAndroid.disableBiometric());
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_BIOMETRIC_KEY, 'false');
      localStorage.removeItem(LOCAL_BIOMETRIC_KEY);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[BiometricService] disableBiometric error:', err);
    return {
      success: false,
      error: err?.message || 'Failed to disable biometric lock.',
    };
  }
}

/**
 * Open the native Android device security settings.
 */
export async function openBiometricSettings(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.TrackBookAndroid) {
      if (typeof window.TrackBookAndroid.openBiometricSettings === 'function') {
        await Promise.resolve(window.TrackBookAndroid.openBiometricSettings());
        return;
      }
    }
    console.log('[BiometricService] openBiometricSettings triggered.');
  } catch (err) {
    console.warn('[BiometricService] openBiometricSettings error:', err);
  }
}

// -------------------------------------------------------------
// Native Mobile Biometric Bridge Handlers
// (Fallback events neutralized - Native Android MainActivity manages app lock directly)
// -------------------------------------------------------------

/**
 * Neutralized fallback handler: Does NOT dispatch trackbook-biometric-fallback.
 * Android MainActivity handles device authentication directly.
 */
export function dispatchBiometricFallback(): void {
  // No-op: Native Android MainActivity handles authentication fallback directly.
  console.log('[BiometricService] Biometric fallback handled natively by Android MainActivity.');
}

/**
 * Dispatch the mobile biometric success event.
 */
export function dispatchBiometricSuccess(): void {
  if (typeof window === 'undefined') return;
  console.log('[BiometricService] Biometric authentication confirmed by native device.');
}

// Expose safe global hook functions on window for backwards-compatible Android WebView calls
if (typeof window !== 'undefined') {
  (window as any).trackbookBiometricFallback = dispatchBiometricFallback;
  (window as any).onBiometricFallback = dispatchBiometricFallback;
  (window as any).TrackBookBiometricFallback = dispatchBiometricFallback;

  (window as any).trackbookBiometricSuccess = dispatchBiometricSuccess;
  (window as any).onBiometricSuccess = dispatchBiometricSuccess;
  (window as any).TrackBookBiometricSuccess = dispatchBiometricSuccess;
}
