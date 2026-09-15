import { useState, useEffect } from 'react';
import { 
  getAndroidAppVersion, 
  getAndroidAppVersionSync, 
  formatAppVersionDisplay 
} from '../services/appVersionService';

export interface AppVersionState {
  rawVersion: string | null;
  versionDisplay: string;
  isAndroidBridge: boolean;
}

/**
 * Custom React hook to dynamically read and observe the Android APK version.
 * - Always pulls from window.TrackBookAndroid if present.
 * - Falls back to "Version —" in normal browsers.
 * - Updates automatically if new bridge or version is detected.
 * - Never persists to localStorage.
 */
export function useAppVersion(): AppVersionState {
  const [rawVersion, setRawVersion] = useState<string | null>(() => getAndroidAppVersionSync());

  useEffect(() => {
    let isMounted = true;

    const checkVersion = async () => {
      try {
        const v = await getAndroidAppVersion();
        if (isMounted && v !== null) {
          setRawVersion(prev => (prev !== v ? v : prev));
        }
      } catch (err) {
        // Safe fallback
      }
    };

    checkVersion();

    // In Android WebView, the JavaScript bridge might be registered right around window 'load'
    const handleLoad = () => {
      checkVersion();
    };

    window.addEventListener('load', handleLoad);
    const t1 = setTimeout(checkVersion, 250);
    const t2 = setTimeout(checkVersion, 800);
    const t3 = setTimeout(checkVersion, 2000);

    return () => {
      isMounted = false;
      window.removeEventListener('load', handleLoad);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return {
    rawVersion,
    versionDisplay: formatAppVersionDisplay(rawVersion),
    isAndroidBridge: Boolean(rawVersion)
  };
}
