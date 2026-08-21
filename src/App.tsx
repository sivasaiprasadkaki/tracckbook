import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';
import { cn } from './lib/utils';
import SmartUpdateManager from './components/SmartUpdateManager';
import AutoLogoutManager from './components/AutoLogoutManager';
import MpinManager from './components/MpinManager';

function lazyWithRetry(componentImport: () => Promise<any>) {
  return lazy(() =>
    componentImport().catch((error) => {
      console.warn('[lazyWithRetry] Module import failed, retrying...', error);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(componentImport());
        }, 1000);
      }).catch(() => {
        console.error('[lazyWithRetry] Retry failed. Reloading window to fetch current bundle.');
        window.location.reload();
        return { default: () => null as any };
      });
    })
  );
}

import Dashboard from './pages/Dashboard';
const Login = lazyWithRetry(() => import('./pages/Login'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const AdminPortal = lazyWithRetry(() => import('./pages/AdminPortal'));
const AutomationMail = lazyWithRetry(() => import('./pages/AutomationMail'));
const AcceptInvitePage = lazyWithRetry(() => import('./pages/AcceptInvitePage'));

function NavigationHandler({ 
  session, 
  setSession, 
  setLoading 
}: { 
  session: any; 
  setSession: (s: any) => void; 
  setLoading: (l: boolean) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);

  // Sync locationRef and log route changes
  useEffect(() => {
    locationRef.current = location;
    console.log(`[DEBUG] ROUTE CHANGED: ${location.pathname}`);
  }, [location]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Helper to check if current URL has password recovery parameters
    const checkRecoveryContext = () => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const path = locationRef.current.pathname;
      const isResetPath = path === '/reset-password' || path === '/resetpassword';
      const hasRecoveryHash = hash.includes('type=recovery') || (hash.includes('access_token=') && !hash.includes('type=signup'));
      const hasRecoverySearch = search.includes('type=recovery') || search.includes('code=');
      const hasRecoveryError = (hash.includes('error_code=otp_expired') || hash.includes('error=access_denied') || search.includes('error_code=otp_expired') || search.includes('error=access_denied'));
      return { isResetPath, hasRecoveryHash, hasRecoverySearch, hasRecoveryError, isRecovery: isResetPath || hasRecoveryHash || hasRecoverySearch || hasRecoveryError };
    };

    // If initial load has recovery parameters in hash/query and not yet on /reset-password, route immediately
    const initialRecovery = checkRecoveryContext();
    if (initialRecovery.isRecovery && !initialRecovery.isResetPath) {
      const currentHash = window.location.hash || '';
      const currentSearch = window.location.search || '';
      navigate('/reset-password' + currentSearch + currentHash, { replace: true });
    }

    // Get initial session with timeout safety
    const sessionTimeout = setTimeout(() => {
      console.warn('Auth session lookup taking too long, forcing load completion...');
      setLoading(false);
    }, 5000); // 5 second safety net

    supabase.auth.getSession().then((res) => {
      clearTimeout(sessionTimeout);
      const sessionVal = res?.data?.session || null;
      setSession(sessionVal);
      setLoading(false);
      if (sessionVal) {
        console.log('[DEBUG] SESSION REFRESHED');
      }
      
      // If we have recovery parameters in the hash or search, ensure we route to /reset-password
      const recoveryState = checkRecoveryContext();
      if (recoveryState.isRecovery && !recoveryState.isResetPath) {
        const currentHash = window.location.hash || '';
        const currentSearch = window.location.search || '';
        navigate('/reset-password' + currentSearch + currentHash, { replace: true });
      }
    }).catch(err => {
      console.error('Auth session lookup failed:', err);
      clearTimeout(sessionTimeout);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sessionVal) => {
      console.log(`[DEBUG] AUTH STATE CHANGED: ${event}`);
      setSession(sessionVal);
      if (sessionVal) {
        console.log('[DEBUG] SESSION REFRESHED');
      }
      
      const currentPath = locationRef.current.pathname;
      const isResetRoute = currentPath === '/reset-password' || currentPath === '/resetpassword';
      const recoveryState = checkRecoveryContext();

      if (event === 'PASSWORD_RECOVERY') {
        console.log('[DEBUG] Password recovery event detected');
        if (!isResetRoute) {
          const currentHash = window.location.hash || '';
          const currentSearch = window.location.search || '';
          navigate('/reset-password' + currentSearch + currentHash, { replace: true });
        }
      } else if (event === 'SIGNED_IN') {
        // If we are currently in recovery flow or on reset password page, stay on reset password page!
        if (isResetRoute || recoveryState.isRecovery) {
          console.log('[DEBUG] SIGNED_IN during recovery flow - maintaining reset password route');
          return;
        }
        if (currentPath === '/login' || currentPath === '/register' || currentPath === '/signup') {
          navigate('/cashbooks', { replace: true });
        }
      } else if (event === 'SIGNED_OUT') {
        // Only redirect to login if not intentionally on reset password page
        if (!isResetRoute) {
          navigate('/login', { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, setSession, setLoading]);

  return null;
}

export default function App() {
  useEffect(() => {
    console.log('[DEBUG] APP MOUNTED');
    return () => {
      console.log('[DEBUG] APP UNMOUNTED');
    };
  }, []);

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Theme handling
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
    localStorage.setItem('theme', theme);

    // Dynamic meta theme-color for mobile status bar / browser header
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
  }, [theme]);

  // PWA Install Prompt handling
  useEffect(() => {
    // Track app version
    const CURRENT_VERSION = '5.0.0';
    const savedVersion = localStorage.getItem('app_version');
    
    if (!savedVersion) {
      localStorage.setItem('app_version', CURRENT_VERSION);
    } else if (savedVersion !== CURRENT_VERSION) {
      console.log('New version detected:', CURRENT_VERSION);
      localStorage.setItem('app_version', CURRENT_VERSION);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      console.log('PWA install prompt available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const suspenseFallback = (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-indigo-600 animate-duration-1000" size={40} />
        <p className="text-sm font-medium text-slate-500 animate-pulse">Loading view...</p>
      </div>
    </div>
  );

  return (
    <Router>
      <SmartUpdateManager theme={theme} />
      <AutoLogoutManager session={session} />
      <NavigationHandler 
        session={session} 
        setSession={setSession} 
        setLoading={setLoading} 
      />
      
      <MpinManager session={session} theme={theme}>
        <Suspense fallback={suspenseFallback}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login theme={theme} initialMode="signin" />} />
            <Route path="/register" element={<Login theme={theme} initialMode="signup" />} />
            <Route path="/forgot" element={<Login theme={theme} initialMode="forgot" />} />
            <Route path="/signup" element={<Login theme={theme} initialMode="signup" />} />
            <Route path="/reset-password" element={<ResetPassword theme={theme} />} />
            <Route path="/resetpassword" element={<ResetPassword theme={theme} />} />
            <Route path="/accept-invite" element={
              <AcceptInvitePage 
                theme={theme} 
                currentUserEmail={session?.user?.email || 'owner@trackbook.app'} 
                currentUserId={session?.user?.id || 'u_owner'}
                currentUserName={session?.user?.user_metadata?.full_name || 'Logged User'}
              />
            } />
            <Route path="/invitations/:token" element={
              <AcceptInvitePage 
                theme={theme} 
                currentUserEmail={session?.user?.email || 'owner@trackbook.app'} 
                currentUserId={session?.user?.id || 'u_owner'}
                currentUserName={session?.user?.user_metadata?.full_name || 'Logged User'}
              />
            } />
            <Route path="/admin" element={<AdminPortal />} />

            {/* Automation Mail Enterprise Module */}
            <Route 
              path="/automation-mail" 
              element={
                session ? (
                  <AutomationMail session={session} theme={theme} setTheme={setTheme} />
                ) : (
                  loading ? suspenseFallback : <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              path="/automation-mail/:stepName" 
              element={
                session ? (
                  <AutomationMail session={session} theme={theme} setTheme={setTheme} />
                ) : (
                  loading ? suspenseFallback : <Navigate to="/login" replace />
                )
              } 
            />

            {/* Protected Routes */}
            <Route 
              path="/" 
              element={
                session ? (
                  // If there's an active recovery parameter in the URL, go to reset password
                  (typeof window !== 'undefined' && (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery'))) ? (
                    <Navigate to="/reset-password" replace />
                  ) : (
                    <Navigate to="/cashbooks" replace />
                  )
                ) : (
                  // If we are still loading initial session, show a loader
                  loading ? (
                    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-indigo-600" size={40} />
                        <p className="text-sm font-medium text-slate-500 animate-pulse">Initializing app...</p>
                      </div>
                    </div>
                  ) : (
                    (typeof window !== 'undefined' && (
                      window.location.hash.includes('type=recovery') || 
                      window.location.search.includes('type=recovery') || 
                      window.location.hash.includes('error_code=otp_expired') ||
                      window.location.search.includes('error_code=otp_expired')
                    )) ? (
                      <Navigate to="/reset-password" replace />
                    ) : (
                      <Navigate to="/login" replace />
                    )
                  )
                )
              } 
            />
            <Route 
              path="/cashbooks" 
              element={
                session ? (
                  <Dashboard session={session} theme={theme} setTheme={setTheme} />
                ) : (
                  loading ? (
                    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-indigo-600" size={40} />
                        <p className="text-sm font-medium text-slate-500 animate-pulse">Initializing app...</p>
                      </div>
                    </div>
                  ) : <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              path="/cashbooks/:bookSlug" 
              element={
                session ? (
                  <Dashboard session={session} theme={theme} setTheme={setTheme} />
                ) : (
                  loading ? (
                    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-indigo-600" size={40} />
                        <p className="text-sm font-medium text-slate-500 animate-pulse">Initializing app...</p>
                      </div>
                    </div>
                  ) : <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              path="/cashbooks/:bookSlug/:tabName" 
              element={
                session ? (
                  <Dashboard session={session} theme={theme} setTheme={setTheme} />
                ) : (
                  loading ? (
                    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-indigo-600" size={40} />
                        <p className="text-sm font-medium text-slate-500 animate-pulse">Initializing app...</p>
                      </div>
                    </div>
                  ) : <Navigate to="/login" replace />
                )
              } 
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </MpinManager>
    </Router>
  );
}
