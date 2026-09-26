import { useEffect, useRef } from 'react';
import { executeAppLogout } from '../lib/supabase';

// 15 minutes of zero work or movement triggers automatic logout
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes (900,000 ms)
const ACTIVITY_STORAGE_KEY = 'trackbook_last_activity_ts';
const THROTTLE_MS = 1000; // Throttle storage writes to once per second

export default function AutoLogoutManager({ session }: { session: any }) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const lastActiveRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef<boolean>(false);

  useEffect(() => {
    // Only monitor when there is an active session
    if (!session?.user) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    isLoggingOutRef.current = false;

    // Initialize or read last activity timestamp
    const now = Date.now();
    const storedLast = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(ACTIVITY_STORAGE_KEY)) : 0;
    if (storedLast && now - storedLast < INACTIVITY_TIMEOUT_MS) {
      lastActiveRef.current = storedLast;
    } else {
      lastActiveRef.current = now;
      try {
        localStorage.setItem(ACTIVITY_STORAGE_KEY, now.toString());
      } catch {}
    }

    const performInactivityLogout = async () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      console.warn('[AutoLogout] User has been inactive with no work or movement for 15 minutes. Automatically logging out...');
      try {
        await executeAppLogout({ reason: 'inactivity' });
      } catch (err) {
        console.error('[AutoLogout] Error during auto logout:', err);
        window.location.replace('/login');
      }
    };

    const scheduleTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const elapsed = Date.now() - lastActiveRef.current;
      const remaining = Math.max(0, INACTIVITY_TIMEOUT_MS - elapsed);

      if (remaining <= 0) {
        performInactivityLogout();
        return;
      }

      timerRef.current = setTimeout(() => {
        // Double check against real stored timestamp
        const currentStored = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(ACTIVITY_STORAGE_KEY)) || lastActiveRef.current : lastActiveRef.current;
        const actualElapsed = Date.now() - currentStored;
        if (actualElapsed >= INACTIVITY_TIMEOUT_MS) {
          performInactivityLogout();
        } else {
          scheduleTimer();
        }
      }, remaining);
    };

    let lastWriteTime = 0;
    const registerActivity = () => {
      if (isLoggingOutRef.current) return;
      const current = Date.now();
      lastActiveRef.current = current;

      if (current - lastWriteTime > THROTTLE_MS) {
        lastWriteTime = current;
        try {
          localStorage.setItem(ACTIVITY_STORAGE_KEY, current.toString());
        } catch {}
      }

      scheduleTimer();
    };

    // Initial scheduling
    scheduleTimer();

    // Heartbeat check every 5 seconds (handles tab suspension, device sleep, minimized browser)
    heartbeatRef.current = setInterval(() => {
      if (isLoggingOutRef.current) return;
      const currentStored = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(ACTIVITY_STORAGE_KEY)) || lastActiveRef.current : lastActiveRef.current;
      const elapsed = Date.now() - currentStored;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        performInactivityLogout();
      }
    }, 5000);

    // Cross-tab synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ACTIVITY_STORAGE_KEY && e.newValue) {
        const remoteTimestamp = Number(e.newValue);
        if (remoteTimestamp > lastActiveRef.current) {
          lastActiveRef.current = remoteTimestamp;
          scheduleTimer();
        }
      } else if (e.key === 'trackbook_explicit_logout' && e.newValue === 'true') {
        performInactivityLogout();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Re-verify immediately when tab regains visibility or focus
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const currentStored = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(ACTIVITY_STORAGE_KEY)) || lastActiveRef.current : lastActiveRef.current;
        const elapsed = Date.now() - currentStored;
        if (elapsed >= INACTIVITY_TIMEOUT_MS) {
          performInactivityLogout();
        } else {
          lastActiveRef.current = currentStored;
          scheduleTimer();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Interaction & movement event listeners (desktop, mobile, tablet)
    const interactionEvents: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'mouseup',
      'click',
      'contextmenu',
      'keydown',
      'keyup',
      'keypress',
      'touchstart',
      'touchmove',
      'touchend',
      'pointerdown',
      'pointermove',
      'scroll',
      'wheel'
    ];

    interactionEvents.forEach(type => {
      window.addEventListener(type, registerActivity, { passive: true, capture: true });
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      interactionEvents.forEach(type => {
        window.removeEventListener(type, registerActivity, { capture: true });
      });
    };
  }, [session]);

  return null;
}
