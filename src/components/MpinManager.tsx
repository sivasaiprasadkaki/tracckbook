import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import {
  hasConfiguredMpin,
  isMobileOrAndroidApp,
  isAndroidWebView,
  isSessionUnlocked,
  markSessionUnlocked,
  clearSessionUnlocked,
} from '../services/mpinSecurityService';

import { MpinLockScreen } from './MpinLockScreen';
import {
  CreateMpinModal,
  ChangeMpinModal,
  ForgotMpinModal,
  DisableMpinModal,
} from './MpinModals';

interface MpinContextType {
  hasMpin: boolean;
  isMobile: boolean;
  openCreateModal: () => void;
  openChangeModal: () => void;
  openForgotModal: () => void;
  openDisableModal: () => void;
  refreshMpinStatus: () => Promise<void>;
}

const MpinContext = createContext<MpinContextType>({
  hasMpin: false,
  isMobile: false,
  openCreateModal: () => {},
  openChangeModal: () => {},
  openForgotModal: () => {},
  openDisableModal: () => {},
  refreshMpinStatus: async () => {},
});

export const useMpinSecurity = () => useContext(MpinContext);

interface MpinManagerProps {
  session: any;
  theme?: 'light' | 'dark';
  children: React.ReactNode;
}

export default function MpinManager({
  session,
  theme = 'light',
  children,
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

  const [isDisableOpen, setIsDisableOpen] =
    useState(false);

  const backgroundTimeRef =
    useRef<number | null>(null);

  const prevUserIdRef =
    useRef<string | null>(null);

  const isAndroidRef =
    useRef<boolean>(isAndroidWebView());

  // ============================================================
  // ENVIRONMENT
  // ============================================================

  useEffect(() => {
    const updateEnvironment = () => {
      isAndroidRef.current = isAndroidWebView();
      setIsMobile(isMobileOrAndroidApp());
    };

    updateEnvironment();

    window.addEventListener(
      'resize',
      updateEnvironment
    );

    return () => {
      window.removeEventListener(
        'resize',
        updateEnvironment
      );
    };
  }, []);

  // ============================================================
  // CHECK MPIN
  // ============================================================

  const checkMpinStatus = useCallback(async () => {
    if (!userId) {
      setHasMpin(false);
      setIsUnlocked(false);
      setIsCheckingMpin(false);
      return;
    }

    setIsCheckingMpin(true);

    try {
      const configured =
        await hasConfiguredMpin(userId);

      setHasMpin(configured);

      // If user has no MPIN, do not lock.
      if (!configured) {
        setIsUnlocked(true);
      }
    } catch (error) {
      console.error(
        '[MPIN] Failed to check MPIN status:',
        error
      );

      setHasMpin(false);
      setIsUnlocked(true);
    } finally {
      setIsCheckingMpin(false);
    }
  }, [userId]);

  // ============================================================
  // INITIAL USER / SESSION
  // ============================================================

  useEffect(() => {
    if (userId !== prevUserIdRef.current) {
      prevUserIdRef.current = userId || null;

      if (!userId) {
        setHasMpin(false);
        setIsUnlocked(false);
        setIsCheckingMpin(false);
        return;
      }

      /*
       * Fresh credential login remains unlocked.
       * Native Android lifecycle events will explicitly lock it
       * after app goes to background / opens again.
       */
      setIsUnlocked(isSessionUnlocked(userId));

      checkMpinStatus();
    }
  }, [userId, checkMpinStatus]);

  // ============================================================
  // NATIVE ANDROID -> WEB MPIN LOCK
  // ============================================================
  //
  // MainActivity sends:
  //   trackbook-force-tpin
  //
  // IMPORTANT:
  // Do NOT ignore this event in Android WebView.
  // Android controls WHEN to lock.
  // Web React layer controls WHICH MPIN UI is displayed.
  //

  useEffect(() => {
    const forceMpinLock = () => {
      if (!userId) return;

      console.log(
        '[MPIN] Native Android requested immediate lock.'
      );

      clearSessionUnlocked(userId);
      setIsUnlocked(false);
    };

    const handleForceTpin =
      () => forceMpinLock();

    const handleBiometricFallback =
      () => forceMpinLock();

    window.addEventListener(
      'trackbook-force-tpin',
      handleForceTpin
    );

    document.addEventListener(
      'trackbook-force-tpin',
      handleForceTpin
    );

    window.addEventListener(
      'trackbook-biometric-fallback',
      handleBiometricFallback
    );

    document.addEventListener(
      'trackbook-biometric-fallback',
      handleBiometricFallback
    );

    /*
     * Critical race-condition fix:
     *
     * Native MainActivity may set this localStorage value BEFORE
     * React MpinManager mounts.
     *
     * Therefore check it immediately on mount as well.
     */
    try {
      const forceLock =
        localStorage.getItem(
          'trackbook_force_tpin'
        );

      if (forceLock === '1' && userId) {
        console.log(
          '[MPIN] Pending native lock detected on startup.'
        );

        clearSessionUnlocked(userId);
        setIsUnlocked(false);
      }
    } catch (error) {
      console.warn(
        '[MPIN] Unable to read native lock state:',
        error
      );
    }

    return () => {
      window.removeEventListener(
        'trackbook-force-tpin',
        handleForceTpin
      );

      document.removeEventListener(
        'trackbook-force-tpin',
        handleForceTpin
      );

      window.removeEventListener(
        'trackbook-biometric-fallback',
        handleBiometricFallback
      );

      document.removeEventListener(
        'trackbook-biometric-fallback',
        handleBiometricFallback
      );
    };
  }, [userId]);

  // ============================================================
  // NON-ANDROID MOBILE / WEB APP LOCK
  // ============================================================
  //
  // No grace period.
  // The instant the app/page goes to background, lock it.
  //

  useEffect(() => {
    if (
      isAndroidWebView() ||
      !isMobile ||
      !hasMpin ||
      !userId
    ) {
      return;
    }

    const lockImmediately = () => {
      clearSessionUnlocked(userId);
      setIsUnlocked(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        backgroundTimeRef.current = Date.now();
        lockImmediately();
      }
    };

    const handlePageHide = () => {
      backgroundTimeRef.current = Date.now();
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
    userId,
  ]);

  // ============================================================
  // SUCCESSFUL MPIN UNLOCK
  // ============================================================

  const notifyNativeTpinUnlocked =
    useCallback(() => {
      try {
        const nativeBridge =
          (window as any).TrackBookAndroid;

        if (
          nativeBridge &&
          typeof nativeBridge.notifyTpinUnlocked ===
            'function'
        ) {
          nativeBridge.notifyTpinUnlocked();
        }
      } catch (error) {
        console.warn(
          '[MPIN] Native unlock notification failed:',
          error
        );
      }
    }, []);

  const handleUnlock = useCallback(() => {
    if (!userId) return;

    console.log(
      '[MPIN] TPIN verified successfully.'
    );

    try {
      localStorage.removeItem(
        'trackbook_force_tpin'
      );

      sessionStorage.removeItem(
        'tb_biometric_fallback_pending'
      );
    } catch (error) {}

    markSessionUnlocked(userId);
    setIsUnlocked(true);

    // Tell MainActivity that TPIN was successfully verified.
    notifyNativeTpinUnlocked();
  }, [
    userId,
    notifyNativeTpinUnlocked,
  ]);

  // ============================================================
  // MPIN CREATED
  // ============================================================

  const handleMpinCreated =
    useCallback(async () => {
      await checkMpinStatus();

      if (userId) {
        markSessionUnlocked(userId);
      }

      try {
        localStorage.removeItem(
          'trackbook_force_tpin'
        );
      } catch (error) {}

      setIsUnlocked(true);
      notifyNativeTpinUnlocked();
    }, [
      checkMpinStatus,
      userId,
      notifyNativeTpinUnlocked,
    ]);

  // ============================================================
  // MPIN CHANGED
  // ============================================================

  const handleMpinChanged =
    useCallback(async () => {
      await checkMpinStatus();
    }, [
      checkMpinStatus,
    ]);

  // ============================================================
  // MPIN RESET
  // ============================================================

  const handleMpinReset =
    useCallback(async () => {
      await checkMpinStatus();

      if (userId) {
        markSessionUnlocked(userId);
      }

      try {
        localStorage.removeItem(
          'trackbook_force_tpin'
        );
      } catch (error) {}

      setIsUnlocked(true);
      notifyNativeTpinUnlocked();
    }, [
      checkMpinStatus,
      userId,
      notifyNativeTpinUnlocked,
    ]);

  // ============================================================
  // MPIN DISABLED
  // ============================================================

  const handleMpinDisabled =
    useCallback(async () => {
      await checkMpinStatus();
      setIsUnlocked(true);
      notifyNativeTpinUnlocked();
    }, [
      checkMpinStatus,
      notifyNativeTpinUnlocked,
    ]);

  // ============================================================
  // LOCK SCREEN DECISION
  // ============================================================

  /*
   * IMPORTANT:
   *
   * Removed:
   *
   *   !isAndroid &&
   *
   * Android MUST also be able to display the MPIN screen.
   *
   * Native MainActivity decides WHEN app should lock.
   * MpinManager decides how to display the MPIN lock screen.
   */

  const shouldShowLockScreen = Boolean(
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

        openCreateModal: () => {
          setIsCreateOpen(true);
        },

        openChangeModal: () => {
          setIsChangeOpen(true);
        },

        openForgotModal: () => {
          setIsForgotOpen(true);
        },

        openDisableModal: () => {
          setIsDisableOpen(true);
        },

        refreshMpinStatus:
          checkMpinStatus,
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
            onClose={() => {
              setIsCreateOpen(false);
            }}
            userId={userId}
            onSuccess={
              handleMpinCreated
            }
            theme={theme}
          />

          <ChangeMpinModal
            isOpen={isChangeOpen}
            onClose={() => {
              setIsChangeOpen(false);
            }}
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
            onClose={() => {
              setIsForgotOpen(false);
            }}
            userEmail={userEmail}
            userId={userId}
            onSuccess={
              handleMpinReset
            }
            theme={theme}
          />

          <DisableMpinModal
            isOpen={isDisableOpen}
            onClose={() => {
              setIsDisableOpen(false);
            }}
            userId={userId}
            onSuccess={
              handleMpinDisabled
            }
            onOpenForgotMpin={() => {
              setIsDisableOpen(false);
              setIsForgotOpen(true);
            }}
            theme={theme}
          />
        </>
      )}
    </MpinContext.Provider>
  );
}