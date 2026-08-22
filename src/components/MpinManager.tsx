import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react';

import {
  hasConfiguredMpin,
  isMobileOrAndroidApp,
  isSessionUnlocked,
  markSessionUnlocked,
  clearSessionUnlocked
} from '../services/mpinSecurityService';

import { MpinLockScreen } from './MpinLockScreen';
import {
  CreateMpinModal,
  ChangeMpinModal,
  ForgotMpinModal
} from './MpinModals';

interface MpinContextType {
  hasMpin: boolean;
  isMobile: boolean;
  openCreateModal: () => void;
  openChangeModal: () => void;
  openForgotModal: () => void;
  refreshMpinStatus: () => Promise<void>;
}

const MpinContext = createContext<MpinContextType>({
  hasMpin: false,
  isMobile: false,
  openCreateModal: () => {},
  openChangeModal: () => {},
  openForgotModal: () => {},
  refreshMpinStatus: async () => {}
});

export const useMpinSecurity = () => useContext(MpinContext);

interface MpinManagerProps {
  session: any;
  theme?: 'light' | 'dark';
  children: React.ReactNode;
}

const GRACE_PERIOD_MS = 20000;

export default function MpinManager({
  session,
  theme = 'light',
  children
}: MpinManagerProps) {
  const userId = session?.user?.id;

  const userEmail =
    session?.user?.email || '';

  const userName =
    session?.user?.user_metadata?.full_name ||
    userEmail?.split('@')[0] ||
    '';

  const [isMobile, setIsMobile] =
    useState<boolean>(() => isMobileOrAndroidApp());

  const [hasMpin, setHasMpin] =
    useState<boolean>(false);

  const [isCheckingMpin, setIsCheckingMpin] =
    useState<boolean>(true);

  const [isUnlocked, setIsUnlocked] =
    useState<boolean>(() => isSessionUnlocked(userId));

  const [isCreateOpen, setIsCreateOpen] =
    useState(false);

  const [isChangeOpen, setIsChangeOpen] =
    useState(false);

  const [isForgotOpen, setIsForgotOpen] =
    useState(false);

  const backgroundTimeRef =
    useRef<number | null>(null);

  const prevUserIdRef =
    useRef<string | null>(null);

  /*
   * Legacy biometric flags cleanup.
   * Fingerprint is no longer responsible
   * for TrackBook MPIN unlocking.
   */
  useEffect(() => {
    try {
      localStorage.removeItem(
        'trackbook_force_tpin'
      );

      sessionStorage.removeItem(
        'trackbook_force_tpin'
      );

      localStorage.removeItem(
        'tb_biometric_fallback_pending'
      );

      sessionStorage.removeItem(
        'tb_biometric_fallback_pending'
      );
    } catch (_) {}
  }, []);

  /*
   * Keep mobile detection updated.
   */
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(
        isMobileOrAndroidApp()
      );
    };

    window.addEventListener(
      'resize',
      handleResize
    );

    return () => {
      window.removeEventListener(
        'resize',
        handleResize
      );
    };
  }, []);

  /*
   * Check whether current user has configured MPIN.
   */
  const checkMpinStatus =
    useCallback(async () => {
      if (!userId) {
        setHasMpin(false);
        setIsUnlocked(false);
        setIsCheckingMpin(false);
        return;
      }

      try {
        const configured =
          await hasConfiguredMpin(userId);

        setHasMpin(configured);
      } catch (error) {
        console.error(
          '[MPIN] Failed to check MPIN status:',
          error
        );

        setHasMpin(false);
      } finally {
        setIsCheckingMpin(false);
      }
    }, [userId]);

  /*
   * Initial user/session handling.
   *
   * IMPORTANT:
   * Android WebView is NOT automatically
   * marked as unlocked anymore.
   */
  useEffect(() => {
    if (
      userId !==
      prevUserIdRef.current
    ) {
      const unlocked =
        isSessionUnlocked(userId);

      setIsUnlocked(unlocked);

      prevUserIdRef.current =
        userId;

      setIsCheckingMpin(true);

      checkMpinStatus();
    }
  }, [
    userId,
    checkMpinStatus
  ]);

  /*
   * NATIVE ANDROID LOCK EVENT LISTENER
   *
   * MainActivity dispatches:
   *
   * trackbook-force-tpin
   *
   * whenever the Android app must be locked.
   *
   * This immediately removes the unlocked
   * state and forces the MPIN screen.
   */
  useEffect(() => {
    const forceLock = () => {
      if (!userId) return;

      console.log(
        '[MPIN] Native lock request received.'
      );

      try {
        clearSessionUnlocked(userId);
      } catch (_) {}

      setIsUnlocked(false);
    };

    window.addEventListener(
      'trackbook-force-tpin',
      forceLock
    );

    document.addEventListener(
      'trackbook-force-tpin',
      forceLock
    );

    return () => {
      window.removeEventListener(
        'trackbook-force-tpin',
        forceLock
      );

      document.removeEventListener(
        'trackbook-force-tpin',
        forceLock
      );
    };
  }, [userId]);

  /*
   * Legacy biometric events are treated
   * as MPIN lock requests only.
   *
   * They can never unlock the app.
   */
  useEffect(() => {
    const forceLock = () => {
      if (!userId) return;

      try {
        clearSessionUnlocked(userId);
      } catch (_) {}

      setIsUnlocked(false);
    };

    window.addEventListener(
      'trackbook-biometric-fallback',
      forceLock
    );

    document.addEventListener(
      'trackbook-biometric-fallback',
      forceLock
    );

    window.addEventListener(
      'trackbook-biometric-cancel',
      forceLock
    );

    document.addEventListener(
      'trackbook-biometric-cancel',
      forceLock
    );

    return () => {
      window.removeEventListener(
        'trackbook-biometric-fallback',
        forceLock
      );

      document.removeEventListener(
        'trackbook-biometric-fallback',
        forceLock
      );

      window.removeEventListener(
        'trackbook-biometric-cancel',
        forceLock
      );

      document.removeEventListener(
        'trackbook-biometric-cancel',
        forceLock
      );
    };
  }, [userId]);

  /*
   * Standard mobile/browser lifecycle lock.
   *
   * Android native lifecycle is also handled
   * by MainActivity. This web listener remains
   * safe as an additional lock layer.
   */
  useEffect(() => {
    if (
      !isMobile ||
      !hasMpin ||
      !userId
    ) {
      return;
    }

    const lockImmediately = () => {
      backgroundTimeRef.current =
        Date.now();

      try {
        clearSessionUnlocked(userId);
      } catch (_) {}

      setIsUnlocked(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lockImmediately();
      } else {
        backgroundTimeRef.current = null;
      }
    };

    const handlePageHide = () => {
      lockImmediately();
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    window.addEventListener(
      'pagehide',
      handlePageHide
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );

      window.removeEventListener(
        'pagehide',
        handlePageHide
      );
    };
  }, [
    isMobile,
    hasMpin,
    userId
  ]);

  /*
   * Correct MPIN entered.
   */
  const handleUnlock = () => {
    if (!userId) return;

    try {
      sessionStorage.removeItem(
        'tb_biometric_fallback_pending'
      );

      markSessionUnlocked(userId);
    } catch (_) {}

    setIsUnlocked(true);

    /*
     * Notify native MainActivity that the
     * MPIN verification succeeded.
     */
    try {
      const androidBridge =
        (window as any).TrackBookAndroid;

      if (
        androidBridge &&
        typeof androidBridge.notifyTpinUnlocked ===
          'function'
      ) {
        androidBridge.notifyTpinUnlocked();
      }
    } catch (error) {
      console.error(
        '[MPIN] Failed to notify Android:',
        error
      );
    }
  };

  /*
   * New MPIN created.
   */
  const handleMpinCreated =
    async () => {
      await checkMpinStatus();

      if (userId) {
        try {
          markSessionUnlocked(userId);
        } catch (_) {}
      }

      setIsUnlocked(true);
    };

  /*
   * Existing MPIN changed.
   */
  const handleMpinChanged =
    async () => {
      await checkMpinStatus();
    };

  /*
   * Forgot/reset MPIN completed.
   *
   * Existing behavior retained.
   */
  const handleMpinReset =
    async () => {
      await checkMpinStatus();

      if (userId) {
        try {
          markSessionUnlocked(userId);
        } catch (_) {}
      }

      setIsUnlocked(true);
    };

  /*
   * Full-screen MPIN lock decision.
   *
   * IMPORTANT:
   * There is NO Android bypass here.
   *
   * Android WebView also shows the MPIN
   * screen when MainActivity requests it.
   */
  const shouldShowLockScreen =
    Boolean(
      session &&
      isMobile &&
      hasMpin &&
      !isUnlocked &&
      !isCheckingMpin
    );

  return (
    <MpinContext.Provider
      value={{
        hasMpin,
        isMobile,

        openCreateModal: () =>
          setIsCreateOpen(true),

        openChangeModal: () =>
          setIsChangeOpen(true),

        openForgotModal: () =>
          setIsForgotOpen(true),

        refreshMpinStatus:
          checkMpinStatus
      }}
    >
      {shouldShowLockScreen ? (
        <MpinLockScreen
          userId={userId}
          userEmail={userEmail}
          userName={userName}
          onUnlock={handleUnlock}
          theme={theme}
        />
      ) : (
        children
      )}

      {userId && (
        <>
          <CreateMpinModal
            isOpen={isCreateOpen}
            onClose={() =>
              setIsCreateOpen(false)
            }
            userId={userId}
            onSuccess={
              handleMpinCreated
            }
            theme={theme}
          />

          <ChangeMpinModal
            isOpen={isChangeOpen}
            onClose={() =>
              setIsChangeOpen(false)
            }
            userId={userId}
            onSuccess={
              handleMpinChanged
            }
            onOpenForgotMpin={() => {
              setIsChangeOpen(false);
              setIsForgotOpen(true);
            }}
            theme={theme}
          />

          <ForgotMpinModal
            isOpen={isForgotOpen}
            onClose={() =>
              setIsForgotOpen(false)
            }
            userEmail={userEmail}
            userId={userId}
            onSuccess={
              handleMpinReset
            }
            theme={theme}
          />
        </>
      )}
    </MpinContext.Provider>
  );
}