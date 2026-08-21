import React, { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function AutoLogoutManager({ session }: { session: any }) {
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only monitor on stable sessions
    if (!session || !supabase) return;

    // "Desktop users only" - Mobile view/devices will never be logged out automatically
    const checkIsDesktop = () => {
      if (typeof window === 'undefined') return false;
      const ua = navigator.userAgent || '';
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
      const isSmallScreen = window.innerWidth < 1024;
      const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      
      if (isMobileUA || isSmallScreen || hasTouch) {
        return false;
      }
      return true;
    };

    if (!checkIsDesktop()) {
      console.log('[AutoLogout] Mobile device/view detected. Automatic inactivity logout is disabled.');
      return;
    }

    const handleInactivityLogout = async () => {
      console.warn('[AutoLogout] User inactive for 10 minutes. Triggering secure automatic logout...');
      try {
        if (supabase) {
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.error('[AutoLogout] Supabase signOut error:', err);
      } finally {
        // Clear session references
        localStorage.removeItem('supabase_remember_me');
        sessionStorage.setItem('logout_reason', 'inactivity');
        navigate('/login', { replace: true });
        // Force window location replace to be doubly safe and clear state structures completely
        window.location.reload();
      }
    };

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      // "If no activity for 10 minutes"
      // 10 minutes = 10 * 60 * 1000 = 600,000 ms
      const timeoutMs = 10 * 60 * 1000;
      timerRef.current = setTimeout(handleInactivityLogout, timeoutMs);
    };

    // Register initial reset
    resetTimer();

    // Listeners for "mouse movement, keyboard activity, clicks, scrolling"
    const interactionEvents = ['mousemove', 'keydown', 'click', 'scroll'];

    const handleEvent = () => {
      resetTimer();
    };

    interactionEvents.forEach(type => {
      window.addEventListener(type, handleEvent, { passive: true });
    });

    console.log('[AutoLogout] Inactivity timer established for Desktop user (10-minute timeout).');

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      interactionEvents.forEach(type => {
        window.removeEventListener(type, handleEvent);
      });
    };
  }, [session, navigate]);

  return null;
}
