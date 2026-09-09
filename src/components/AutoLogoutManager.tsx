import React, { useEffect, useRef } from 'react';
import { supabase, isMobileDeviceOrView } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function AutoLogoutManager({ session }: { session: any }) {
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only monitor on stable sessions
    if (!session || !supabase) return;

    // Mobile view / devices will NEVER be logged out automatically.
    // Once logged in on mobile view, user stays logged in until they explicitly log out.
    if (isMobileDeviceOrView()) {
      console.log('[AutoLogout] Mobile view/device detected. Auto-logout is permanently disabled.');
      return;
    }

    const checkIsStrictDesktop = () => {
      if (typeof window === 'undefined') return false;
      if (isMobileDeviceOrView()) return false;
      const isSmallScreen = window.innerWidth < 1024;
      return !isSmallScreen;
    };

    const handleInactivityLogout = async () => {
      // Re-verify strictly: NEVER logout if user is in mobile view or on a mobile device
      if (!checkIsStrictDesktop()) {
        console.log('[AutoLogout] Mobile view detected at timeout check. Aborting auto-logout.');
        return;
      }

      console.warn('[AutoLogout] Desktop user inactive for 10 minutes. Triggering automatic logout...');
      try {
        if (supabase) {
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.error('[AutoLogout] Supabase signOut error:', err);
      } finally {
        sessionStorage.setItem('logout_reason', 'inactivity');
        navigate('/login', { replace: true });
        window.location.reload();
      }
    };

    const resetTimer = () => {
      if (!checkIsStrictDesktop()) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      // 10 minutes for inactive desktop sessions only
      const timeoutMs = 10 * 60 * 1000;
      timerRef.current = setTimeout(handleInactivityLogout, timeoutMs);
    };

    // Register initial reset if on desktop
    resetTimer();

    // Listeners for mouse movement, keyboard activity, clicks, scrolling, touch, pointer
    const interactionEvents = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
      'touchmove',
      'touchend',
      'pointerdown'
    ];

    const handleEvent = () => {
      resetTimer();
    };

    interactionEvents.forEach(type => {
      window.addEventListener(type, handleEvent, { passive: true });
    });

    // Resize listener: if resized to mobile view, immediately abort and cancel any active timer
    const handleResize = () => {
      if (!checkIsStrictDesktop()) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      } else {
        resetTimer();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      interactionEvents.forEach(type => {
        window.removeEventListener(type, handleEvent);
      });
      window.removeEventListener('resize', handleResize);
    };
  }, [session, navigate]);

  return null;
}
