import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  hasConfiguredMpin, 
  isMobileOrAndroidApp,
  isAndroidWebView,
  isSessionUnlocked,
  markSessionUnlocked,
  clearSessionUnlocked
} from '../services/mpinSecurityService';
import { MpinLockScreen } from './MpinLockScreen';
import { CreateMpinModal, ChangeMpinModal, ForgotMpinModal } from './MpinModals';

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
  refreshMpinStatus: async () => {},
});

export const useMpinSecurity = () => useContext(MpinContext);

interface MpinManagerProps {
  session: any;
  theme?: 'light' | 'dark';
  children: React.ReactNode;
}

const GRACE_PERIOD_MS = 20000; // 20 seconds grace period for non-Android quick app switchers

export default function MpinManager({ session, theme = 'light', children }: MpinManagerProps) {
  const userId = session?.user?.id;
  const userEmail = session?.user?.email || '';
  const userName = session?.user?.user_metadata?.full_name || userEmail?.split('@')[0] || '';

  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileOrAndroidApp());
  const [hasMpin, setHasMpin] = useState<boolean>(false);
  const [isCheckingMpin, setIsCheckingMpin] = useState<boolean>(true);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => isSessionUnlocked(userId));

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const backgroundTimeRef = useRef<number | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  // Clean up legacy fallback/force flags on mount
  useEffect(() => {
    try {
      localStorage.removeItem('trackbook_force_tpin');
      sessionStorage.removeItem('trackbook_force_tpin');
      localStorage.removeItem('tb_biometric_fallback_pending');
      sessionStorage.removeItem('tb_biometric_fallback_pending');
    } catch (e) {}
  }, []);

  // Re-check mobile environment on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileOrAndroidApp());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check MPIN configuration for current user
  const checkMpinStatus = useCallback(async () => {
    if (!userId) {
      setHasMpin(false);
      setIsUnlocked(false);
      setIsCheckingMpin(false);
      return;
    }

    try {
      const configured = await hasConfiguredMpin(userId);
      setHasMpin(configured);
    } catch (e) {
      console.error('Failed to check MPIN status:', e);
      setHasMpin(false);
    } finally {
      setIsCheckingMpin(false);
    }
  }, [userId]);

  // Handle User Change or Initial Load
  useEffect(() => {
    if (userId !== prevUserIdRef.current) {
      // In Android WebView, native Android MainActivity is authoritative for app lock.
      if (isAndroidWebView()) {
        setIsUnlocked(true);
      } else {
        const unlocked = isSessionUnlocked(userId);
        setIsUnlocked(unlocked);
      }
      prevUserIdRef.current = userId;
      setIsCheckingMpin(true);
      checkMpinStatus();
    }
  }, [userId, checkMpinStatus]);

  // App Background / Resume Lock Handling (Non-Android Web Only)
  // Disabled in Android WebView because native MainActivity handles lifecycle lock
  useEffect(() => {
    if (isAndroidWebView() || !isMobile || !hasMpin || !userId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App sent to background
        backgroundTimeRef.current = Date.now();
      } else {
        // App returned to foreground
        if (backgroundTimeRef.current) {
          const elapsed = Date.now() - backgroundTimeRef.current;
          if (elapsed > GRACE_PERIOD_MS) {
            console.log(`[MPIN] Web session resumed after ${Math.round(elapsed / 1000)}s - locking web view.`);
            clearSessionUnlocked(userId);
            setIsUnlocked(false);
          }
          backgroundTimeRef.current = null;
        }
      }
    };

    const handlePageHide = () => {
      backgroundTimeRef.current = Date.now();
    };

    const handlePageShow = () => {
      if (backgroundTimeRef.current) {
        const elapsed = Date.now() - backgroundTimeRef.current;
        if (elapsed > GRACE_PERIOD_MS) {
          clearSessionUnlocked(userId);
          setIsUnlocked(false);
        }
        backgroundTimeRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isMobile, hasMpin, userId]);

  const handleUnlock = () => {
    try {
      sessionStorage.removeItem('tb_biometric_fallback_pending');
    } catch (e) {}
    if (userId) {
      markSessionUnlocked(userId);
    }
    setIsUnlocked(true);
  };

  const handleMpinCreated = async () => {
    await checkMpinStatus();
    if (userId) {
      markSessionUnlocked(userId);
    }
    setIsUnlocked(true);
  };

  const handleMpinChanged = async () => {
    await checkMpinStatus();
  };

  const handleMpinReset = async () => {
    await checkMpinStatus();
    if (userId) {
      markSessionUnlocked(userId);
    }
    setIsUnlocked(true);
  };

  // Determine if full-screen lock should be shown:
  // 1. Must NOT be running inside the TrackBook Android WebView (Native MainActivity handles lock)
  // 2. Must have an active authenticated session
  // 3. Must be Mobile or standalone container
  // 4. User must have an MPIN configured
  // 5. App is not yet unlocked
  // 6. Not still performing initial MPIN existence check
  const isAndroid = isAndroidWebView();
  const shouldShowLockScreen = Boolean(
    !isAndroid &&
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
        openCreateModal: () => setIsCreateOpen(true),
        openChangeModal: () => setIsChangeOpen(true),
        openForgotModal: () => setIsForgotOpen(true),
        refreshMpinStatus: checkMpinStatus,
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

      {/* Profile/App Modals */}
      {userId && (
        <>
          <CreateMpinModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            userId={userId}
            onSuccess={handleMpinCreated}
            theme={theme}
          />
          <ChangeMpinModal
            isOpen={isChangeOpen}
            onClose={() => setIsChangeOpen(false)}
            userId={userId}
            onSuccess={handleMpinChanged}
            onOpenForgotMpin={() => {
              setIsChangeOpen(false);
              setIsForgotOpen(true);
            }}
            theme={theme}
          />
          <ForgotMpinModal
            isOpen={isForgotOpen}
            onClose={() => setIsForgotOpen(false)}
            userEmail={userEmail}
            userId={userId}
            onSuccess={handleMpinReset}
            theme={theme}
          />
        </>
      )}
    </MpinContext.Provider>
  );
}
