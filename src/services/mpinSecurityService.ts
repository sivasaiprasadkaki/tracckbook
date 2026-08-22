/**
 * MPIN Security Service for TrackBook
 * 
 * Provides secure cryptographic hashing (PBKDF2/SHA-256 with unique salts),
 * account-specific storage, weak MPIN detection, failed attempts lockout,
 * and support for native Android Keystore bridge.
 */

// Native Android Keystore Bridge Interface (if provided by Android WebView)
interface AndroidBridge {
  hasSecureMpin?: (userId: string) => boolean;
  saveSecureMpin?: (userId: string, hash: string) => boolean;
  getSecureMpin?: (userId: string) => string | null;
  removeSecureMpin?: (userId: string) => boolean;
}

declare global {
  interface Window {
    Android?: AndroidBridge;
    AndroidBridge?: AndroidBridge;
    TrackBookNative?: AndroidBridge;
  }
}

const STORAGE_PREFIX = 'tb_mpin_sec_v1_';
const MAX_FAILED_ATTEMPTS = 5;
const INITIAL_LOCKOUT_SECONDS = 30;

// Obvious weak and sequential pattern lists
const BANNED_MPINS = new Set([
  '123456', '654321', '012345', '543210',
  '000000', '111111', '222222', '333333', '444444', 
  '555555', '666666', '777777', '888888', '999999',
  '123123', '321321', '121212', '212121', '112233', '332211',
  '111222', '222111', '000111', '123321', '654456'
]);

/**
 * Validate MPIN strength
 * Checks for 6 digits, repeated characters, forward/reverse sequences, and common patterns.
 */
export function validateMpinStrength(mpin: string): { isValid: boolean; error?: string } {
  if (!mpin) {
    return { isValid: false, error: 'TPIN is required.' };
  }

  if (!/^\d{6}$/.test(mpin)) {
    return { isValid: false, error: 'TPIN must be exactly 6 digits.' };
  }

  if (BANNED_MPINS.has(mpin)) {
    return { isValid: false, error: 'This TPIN is too common or easy to guess. Choose a stronger one.' };
  }

  // Check all identical digits (e.g., 000000, 777777)
  const isAllSame = mpin.split('').every((char) => char === mpin[0]);
  if (isAllSame) {
    return { isValid: false, error: 'Repeated digits (e.g. 111111) are not allowed.' };
  }

  // Check forward consecutive sequence (e.g. 123456, 234567, 345678)
  let isForwardSeq = true;
  for (let i = 0; i < 5; i++) {
    if (parseInt(mpin[i + 1], 10) !== (parseInt(mpin[i], 10) + 1) % 10) {
      isForwardSeq = false;
      break;
    }
  }
  if (isForwardSeq) {
    return { isValid: false, error: 'Sequential numbers (e.g. 123456) are not allowed.' };
  }

  // Check reverse consecutive sequence (e.g. 654321, 543210)
  let isReverseSeq = true;
  for (let i = 0; i < 5; i++) {
    if (parseInt(mpin[i + 1], 10) !== (parseInt(mpin[i], 10) - 1 + 10) % 10) {
      isReverseSeq = false;
      break;
    }
  }
  if (isReverseSeq) {
    return { isValid: false, error: 'Reverse sequential numbers (e.g. 654321) are not allowed.' };
  }

  // Check repeated pairs (e.g. 121212 or 454545)
  if (mpin.slice(0, 2) === mpin.slice(2, 4) && mpin.slice(2, 4) === mpin.slice(4, 6)) {
    return { isValid: false, error: 'Repeating 2-digit patterns are not allowed.' };
  }

  // Check repeated triplets (e.g. 123123)
  if (mpin.slice(0, 3) === mpin.slice(3, 6)) {
    return { isValid: false, error: 'Repeating 3-digit patterns are not allowed.' };
  }

  return { isValid: true };
}

/**
 * Derives a secure cryptographic hash for the given MPIN using PBKDF2/SHA-256 with a unique salt
 */
async function hashMpinWithSalt(mpin: string, userId: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(`tb_${userId}_${mpin}_secure_kdf`);
  const saltBuffer = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedKey));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a cryptographically random salt
 */
function generateSalt(): string {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  return Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Reliable Android WebView environment detector.
 * Identifies whether TrackBook is running within the native Android wrapper / WebView.
 * In this environment, native Android MainActivity is authoritative for app lock and biometric security.
 */
export function isAndroidWebView(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Explicit native Android bridge objects injected by Android MainActivity / WebView
  if (
    Boolean(window.Android) ||
    Boolean(window.AndroidBridge) ||
    Boolean(window.TrackBookNative) ||
    Boolean(window.TrackBookAndroid) ||
    Boolean((window as any).TrackBookAndroidBridge)
  ) {
    return true;
  }

  // 2. Explicit JavaScript flags or session/local storage indicators
  if (
    (window as any).isAndroidWebView === true ||
    (window as any).isAndroidApp === true ||
    (window as any).isNativeAndroid === true
  ) {
    return true;
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (
      urlParams.get('platform') === 'android' ||
      urlParams.get('env') === 'android_webview' ||
      urlParams.get('isAndroid') === 'true' ||
      urlParams.get('source') === 'android_app'
    ) {
      return true;
    }
  } catch (e) {}

  try {
    if (
      sessionStorage.getItem('tb_is_android_webview') === 'true' ||
      localStorage.getItem('tb_is_android_webview') === 'true'
    ) {
      return true;
    }
  } catch (e) {}

  // 3. User Agent pattern detection
  const ua = navigator.userAgent || navigator.vendor || '';

  // Custom TrackBook app signature in User Agent
  if (/TrackBookAndroid|TrackBookApp|TrackBookNative|TrackBook\/Android/i.test(ua)) {
    return true;
  }

  // Standard Android WebView tokens:
  // Android WebViews usually contain "Android" AND ("Version/X.X" or "wv" or "; wv")
  const isAndroid = /Android/i.test(ua);
  const isWebViewToken = /;\s*wv\b|Android.*Version\/[0-9.]+|Version\/[0-9.]+\s+(?:Mobile\s+)?Safari/i.test(ua);

  if (isAndroid && isWebViewToken) {
    return true;
  }

  return false;
}

/**
 * Checks if the current environment is a Mobile / Android wrapper.
 * Returns false on Desktop web to guarantee Web App Isolation.
 */
export function isMobileOrAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Explicit native Android WebView bridges or markers
  if (isAndroidWebView()) {
    return true;
  }

  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
  const isSmallScreen = window.innerWidth < 1024;

  // If user is explicitly on a mobile user-agent or mobile standalone container
  if (isMobileUA || (isSmallScreen && isStandalone)) {
    return true;
  }

  // Desktop browser (width >= 1024 and not mobile UA) is NEVER treated as mobile app
  if (!isMobileUA && window.innerWidth >= 1024) {
    return false;
  }

  return isMobileUA || isSmallScreen;
}

/**
 * Check if the given user has an MPIN configured
 */
export async function hasConfiguredMpin(userId: string): Promise<boolean> {
  if (!userId) return false;

  // Check Android bridge if present
  const bridge = window.Android || window.AndroidBridge || window.TrackBookNative;
  if (bridge?.hasSecureMpin) {
    try {
      return bridge.hasSecureMpin(userId);
    } catch (e) {
      console.warn('Native Android bridge check failed, falling back to secure store', e);
    }
  }

  const recordStr = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
  if (!recordStr) return false;

  try {
    const record = JSON.parse(recordStr);
    return Boolean(record && record.hash && record.salt);
  } catch {
    return false;
  }
}

/**
 * Save a new MPIN for the authenticated user
 */
export async function saveUserMpin(userId: string, mpin: string): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: 'User ID is required.' };

  const validation = validateMpinStrength(mpin);
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  try {
    const salt = generateSalt();
    const hash = await hashMpinWithSalt(mpin, userId, salt);

    const record = {
      salt,
      hash,
      createdAt: Date.now(),
      version: 1,
    };

    // Save to native bridge if available
    const bridge = window.Android || window.AndroidBridge || window.TrackBookNative;
    if (bridge?.saveSecureMpin) {
      try {
        bridge.saveSecureMpin(userId, JSON.stringify(record));
      } catch (e) {
        console.warn('Native bridge save failed, saving to secure store:', e);
      }
    }

    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(record));
    resetLockoutState(userId);

    return { success: true };
  } catch (err: any) {
    console.error('Error saving MPIN:', err);
    return { success: false, error: 'Failed to securely encrypt and save MPIN.' };
  }
}

/**
 * Verify an entered MPIN against stored cryptographic record
 */
export async function verifyUserMpin(userId: string, enteredMpin: string): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
  if (!userId) return { success: false, error: 'User session not found.' };

  // Check lockout
  const lockoutRemaining = getLockoutSecondsRemaining(userId);
  if (lockoutRemaining > 0) {
    return {
      success: false,
      error: `Too many failed attempts. Please wait ${lockoutRemaining} seconds or reset via Forgot TPIN.`,
    };
  }

  const recordStr = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
  if (!recordStr) {
    return { success: false, error: 'No TPIN set for this account.' };
  }

  try {
    const record = JSON.parse(recordStr);
    if (!record.salt || !record.hash) {
      return { success: false, error: 'Corrupted TPIN record. Please reset using Forgot TPIN.' };
    }

    const calculatedHash = await hashMpinWithSalt(enteredMpin, userId, record.salt);

    if (calculatedHash === record.hash) {
      // Successful match
      resetLockoutState(userId);
      return { success: true };
    } else {
      // Failed attempt
      const remaining = recordFailedAttempt(userId);
      if (remaining <= 0) {
        return {
          success: false,
          error: `Incorrect TPIN. Account locked for ${INITIAL_LOCKOUT_SECONDS}s.`,
          remainingAttempts: 0,
        };
      }
      return {
        success: false,
        error: `Incorrect TPIN. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`,
        remainingAttempts: remaining,
      };
    }
  } catch (err) {
    console.error('Error during TPIN verification:', err);
    return { success: false, error: 'Verification failed. Please try again.' };
  }
}

/**
 * Remove/Delete MPIN for the user (e.g. after full account reset)
 */
export function removeUserMpin(userId: string): void {
  if (!userId) return;
  localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
  resetLockoutState(userId);

  const bridge = window.Android || window.AndroidBridge || window.TrackBookNative;
  if (bridge?.removeSecureMpin) {
    try {
      bridge.removeSecureMpin(userId);
    } catch (e) {
      console.warn('Native remove failed:', e);
    }
  }
}

// -------------------------------------------------------------
// Lockout and Failed Attempts Tracking
// -------------------------------------------------------------

interface LockoutData {
  failedAttempts: number;
  lockedUntil: number;
}

function getLockoutKey(userId: string): string {
  return `tb_mpin_lockout_${userId}`;
}

export function getLockoutSecondsRemaining(userId: string): number {
  if (!userId) return 0;
  const raw = localStorage.getItem(getLockoutKey(userId));
  if (!raw) return 0;
  try {
    const data: LockoutData = JSON.parse(raw);
    if (data.lockedUntil && Date.now() < data.lockedUntil) {
      return Math.ceil((data.lockedUntil - Date.now()) / 1000);
    }
    return 0;
  } catch {
    return 0;
  }
}

export function getFailedAttemptsCount(userId: string): number {
  if (!userId) return 0;
  const raw = localStorage.getItem(getLockoutKey(userId));
  if (!raw) return 0;
  try {
    const data: LockoutData = JSON.parse(raw);
    return data.failedAttempts || 0;
  } catch {
    return 0;
  }
}

function recordFailedAttempt(userId: string): number {
  const currentCount = getFailedAttemptsCount(userId) + 1;
  let lockedUntil = 0;

  if (currentCount >= MAX_FAILED_ATTEMPTS) {
    // Lock for INITIAL_LOCKOUT_SECONDS (e.g. 30 seconds, plus 15s for further attempts)
    const multiplier = Math.max(1, currentCount - MAX_FAILED_ATTEMPTS + 1);
    lockedUntil = Date.now() + (INITIAL_LOCKOUT_SECONDS * multiplier * 1000);
  }

  const data: LockoutData = {
    failedAttempts: currentCount,
    lockedUntil,
  };

  localStorage.setItem(getLockoutKey(userId), JSON.stringify(data));
  return Math.max(0, MAX_FAILED_ATTEMPTS - currentCount);
}

export function resetLockoutState(userId: string): void {
  if (!userId) return;
  localStorage.removeItem(getLockoutKey(userId));
}

// -------------------------------------------------------------
// Active Session Credential Unlock Tracking
// When a user logs in with email/password, OTP, or OAuth, they are already authenticated.
// TPIN should not pop up immediately on fresh credential login.
// -------------------------------------------------------------

export function markSessionUnlocked(userId: string): void {
  if (!userId || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(`tb_auth_unlocked_${userId}`, 'true');
    sessionStorage.setItem('tb_fresh_login_session', 'true');
    sessionStorage.setItem('tb_last_active_user', userId);
  } catch (e) {}
}

export function isSessionUnlocked(userId?: string): boolean {
  if (!userId || typeof sessionStorage === 'undefined') return false;
  
  // In Android WebView, native Android MainActivity is authoritative for app lock.
  // The web app session is immediately unlocked upon valid user authentication.
  if (isAndroidWebView()) {
    return true;
  }

  try {
    return (
      sessionStorage.getItem(`tb_auth_unlocked_${userId}`) === 'true' ||
      sessionStorage.getItem('tb_fresh_login_session') === 'true'
    );
  } catch (e) {
    return false;
  }
}

export function clearSessionUnlocked(userId?: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (userId) {
      sessionStorage.removeItem(`tb_auth_unlocked_${userId}`);
    }
    sessionStorage.removeItem('tb_fresh_login_session');
  } catch (e) {}
}
