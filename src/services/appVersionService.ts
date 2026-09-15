/**
 * TrackBook App Version Service
 * 
 * Communicates with the native Android APK JavaScript bridge (window.TrackBookAndroid)
 * to retrieve the actual installed app version dynamically.
 * 
 * Production rules:
 * - Never hardcodes a fixed version number.
 * - Never stores the APK version in localStorage.
 * - Never reads website/package.json version as app version.
 * - Returns null / "Version —" when running in standard browser (e.g., trackbook.xyz).
 * - Single source of truth is window.TrackBookAndroid.getAppVersion().
 */

export interface AndroidVersionBridge {
  getAppVersion?: () => string | number | Promise<string | number>;
  getVersion?: () => string | number | Promise<string | number>;
  appVersion?: string | number;
}

/**
 * Asynchronously retrieves the installed Android APK version from the native bridge.
 * Returns null if running in standard web browser or if the bridge is unavailable.
 */
export async function getAndroidAppVersion(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const bridge = (window as any).TrackBookAndroid || (window as any).TrackBookAndroidBridge;
    if (!bridge) return null;

    if (typeof bridge.getAppVersion === 'function') {
      const raw = bridge.getAppVersion();
      const resolved = (raw instanceof Promise || (raw && typeof raw.then === 'function'))
        ? await raw
        : raw;
      if (resolved !== undefined && resolved !== null) {
        const str = String(resolved).trim();
        return str.length > 0 ? str : null;
      }
    }

    if (typeof bridge.getVersion === 'function') {
      const raw = bridge.getVersion();
      const resolved = (raw instanceof Promise || (raw && typeof raw.then === 'function'))
        ? await raw
        : raw;
      if (resolved !== undefined && resolved !== null) {
        const str = String(resolved).trim();
        return str.length > 0 ? str : null;
      }
    }

    if (bridge.appVersion !== undefined && bridge.appVersion !== null) {
      const str = String(bridge.appVersion).trim();
      return str.length > 0 ? str : null;
    }
  } catch (err) {
    console.warn('[TrackBookAndroid] Error retrieving app version from bridge:', err);
  }

  return null;
}

/**
 * Synchronously checks if the version is immediately readable from the native bridge.
 */
export function getAndroidAppVersionSync(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const bridge = (window as any).TrackBookAndroid || (window as any).TrackBookAndroidBridge;
    if (!bridge) return null;

    if (typeof bridge.getAppVersion === 'function') {
      const res = bridge.getAppVersion();
      if (typeof res === 'string' || typeof res === 'number') {
        const str = String(res).trim();
        return str.length > 0 ? str : null;
      }
    }

    if (typeof bridge.getVersion === 'function') {
      const res = bridge.getVersion();
      if (typeof res === 'string' || typeof res === 'number') {
        const str = String(res).trim();
        return str.length > 0 ? str : null;
      }
    }

    if (bridge.appVersion !== undefined && bridge.appVersion !== null) {
      const str = String(bridge.appVersion).trim();
      return str.length > 0 ? str : null;
    }
  } catch {
    // Graceful fallback
  }

  return null;
}

/**
 * Formats the version string into standard user-facing display.
 * 
 * Expected:
 * - APK versionName = "1" -> "Version 1"
 * - APK versionName = "2" -> "Version 2"
 * - APK versionName = "3" -> "Version 3"
 * - Browser fallback (no bridge) -> "Version —"
 */
export function formatAppVersionDisplay(version: string | null | undefined): string {
  if (!version) {
    return 'Version \u2014';
  }

  const trimmed = String(version).trim();
  if (!trimmed || trimmed === '\u2014' || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') {
    return 'Version \u2014';
  }

  // Remove any pre-existing "Version" or "v" prefix if already supplied by bridge
  const clean = trimmed.replace(/^version\s+/i, '').replace(/^v\s*/i, '');
  if (!clean) {
    return 'Version \u2014';
  }

  return `Version ${clean}`;
}
