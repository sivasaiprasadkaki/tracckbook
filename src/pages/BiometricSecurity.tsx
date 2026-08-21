import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Fingerprint, 
  ScanFace, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Settings2, 
  ExternalLink,
  Loader2,
  Lock,
  Smartphone
} from 'lucide-react';
import { cn, vibrate } from '../lib/utils';
import { 
  isBiometricSupported, 
  isBiometricEnabled, 
  enableBiometric, 
  disableBiometric, 
  openBiometricSettings 
} from '../services/biometricSecurityService';

interface BiometricSecurityProps {
  session?: any;
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
}

export default function BiometricSecurity({
  session,
  theme = 'light',
}: BiometricSecurityProps) {
  const navigate = useNavigate();

  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize status on page load
  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        setIsLoading(true);
        const [supported, enabled] = await Promise.all([
          isBiometricSupported(),
          isBiometricEnabled(),
        ]);

        if (isMounted) {
          setIsSupported(supported);
          setIsEnabled(enabled);
        }
      } catch (err) {
        console.error('Failed to query biometric status:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleBiometric = async () => {
    vibrate(10);
    setSuccessMessage(null);
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      if (isEnabled) {
        // Disable Flow
        const res = await disableBiometric();
        if (res.success) {
          setIsEnabled(false);
          setSuccessMessage('Biometric lock disabled.');
          vibrate([20, 20]);
        } else {
          setErrorMessage(res.error || 'Failed to disable biometric lock.');
          vibrate([40, 40]);
        }
      } else {
        // Enable Flow
        // Check hardware support first
        const supported = await isBiometricSupported();
        if (!supported) {
          setIsSupported(false);
          setErrorMessage('Biometric authentication is not available on this device.');
          vibrate([40, 40, 40]);
          setIsProcessing(false);
          return;
        }

        const res = await enableBiometric();
        if (res.success) {
          setIsEnabled(true);
          setSuccessMessage('Fingerprint / Face Lock enabled successfully.');
          vibrate([30, 50]);
        } else {
          if (res.isUnsupported) {
            setIsSupported(false);
          }
          setErrorMessage(res.error || 'Biometric authentication failed.');
          vibrate([40, 40]);
        }
      }
    } catch (err: any) {
      console.error('Error during biometric toggle:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenSettings = async () => {
    vibrate(8);
    await openBiometricSettings();
  };

  return (
    <div className={cn(
      "min-h-screen w-full flex flex-col font-sans transition-colors duration-200 select-none",
      theme === 'dark' ? "bg-[#09090b] text-zinc-100" : "bg-[#f8fafc] text-slate-900"
    )}>
      {/* Top Mobile Header */}
      <header className={cn(
        "sticky top-0 z-30 w-full px-4 h-14 flex items-center justify-between border-b backdrop-blur-md transition-colors",
        theme === 'dark' ? "bg-[#09090b]/90 border-zinc-800/80" : "bg-white/90 border-slate-200/80"
      )}>
        <button
          type="button"
          onClick={() => {
            vibrate(5);
            navigate(-1);
          }}
          className={cn(
            "p-2 -ml-2 rounded-xl transition-colors active:scale-95 flex items-center justify-center cursor-pointer border-none outline-none",
            theme === 'dark' ? "text-zinc-300 hover:bg-zinc-800" : "text-slate-700 hover:bg-slate-100"
          )}
          aria-label="Go Back"
        >
          <ArrowLeft size={20} className="stroke-[2.2]" />
        </button>

        <h1 className="text-base font-bold tracking-tight text-center flex-1 pr-6">
          Biometric Security
        </h1>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-6 flex flex-col justify-between">
        <div className="flex flex-col items-center">
          
          {/* Top Section: TrackBook Logo / Security Icon */}
          <div className="flex flex-col items-center text-center mt-2 mb-6">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-4 border border-indigo-400/30"
            >
              <div className="flex items-center justify-center gap-1">
                <Fingerprint size={32} className="stroke-[2.2] text-white" />
                <ScanFace size={24} className="stroke-[2.2] text-indigo-200" />
              </div>

              {/* Status Indicator Dot */}
              <div className={cn(
                "absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center",
                theme === 'dark' ? "border-[#09090b]" : "border-[#f8fafc]",
                isEnabled ? "bg-emerald-500 text-white" : "bg-zinc-400 text-white"
              )}>
                {isEnabled ? <CheckCircle2 size={12} className="stroke-[3]" /> : <Lock size={10} />}
              </div>
            </motion.div>

            <h2 className="text-xl font-extrabold tracking-tight mb-1.5">
              Biometric Security
            </h2>
            <p className={cn(
              "text-xs leading-relaxed max-w-xs",
              theme === 'dark' ? "text-zinc-400" : "text-slate-500"
            )}>
              Use your fingerprint or face to unlock TrackBook faster.
            </p>
          </div>

          {/* Alert / Notification Feedback */}
          <AnimatePresence mode="wait">
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-2xl flex items-start gap-2.5 text-xs font-semibold shadow-sm mb-4"
              >
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-500" />
                <span className="flex-1 leading-snug">{successMessage}</span>
              </motion.div>
            )}

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="w-full bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-2xl flex items-start gap-2.5 text-xs font-semibold shadow-sm mb-4"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />
                <span className="flex-1 leading-snug">{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Card */}
          <div className={cn(
            "w-full rounded-2xl p-5 border transition-all duration-200 shadow-sm",
            theme === 'dark' ? "bg-zinc-900/90 border-zinc-800" : "bg-white border-slate-200"
          )}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    Fingerprint & Face Unlock
                  </h3>
                  <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                    Device Authentication
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {isLoading ? (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-[11px] font-semibold text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Checking</span>
                  </div>
                ) : isEnabled ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-extrabold tracking-wide uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[11px] font-bold tracking-wide uppercase border border-slate-200 dark:border-zinc-700">
                    Disabled
                  </span>
                )}
              </div>
            </div>

            <p className={cn(
              "text-xs leading-relaxed mb-5",
              theme === 'dark' ? "text-zinc-400" : "text-slate-600"
            )}>
              Unlock TrackBook using the biometric security already configured on your device.
            </p>

            {/* Unsupported Hardware Warning Card */}
            {!isSupported && !isLoading && (
              <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 mb-4 text-xs">
                <div className="flex items-start gap-2.5 text-amber-700 dark:text-amber-400 font-bold mb-1">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-500" />
                  <span>Biometric authentication is not available on this device.</span>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 text-[11px] leading-relaxed mb-3">
                  Please set up fingerprint or face authentication in your Android device security settings.
                </p>
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  className="w-full py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/30 text-amber-800 dark:text-amber-300 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer border border-amber-500/30"
                >
                  <Settings2 size={14} />
                  <span>Open Device Security Settings</span>
                  <ExternalLink size={12} className="opacity-70" />
                </button>
              </div>
            )}

            {/* Main Action Toggle Button */}
            <button
              type="button"
              onClick={handleToggleBiometric}
              disabled={isLoading || isProcessing}
              className={cn(
                "w-full py-3.5 px-4 font-bold text-xs uppercase tracking-wider rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed",
                isEnabled
                  ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 active:scale-[0.99]"
                  : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-600/25 active:scale-[0.99]"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isEnabled ? (
                <>
                  <Lock size={16} />
                  <span>Disable Fingerprint / Face Lock</span>
                </>
              ) : (
                <>
                  <Fingerprint size={16} />
                  <span>Enable Fingerprint / Face Lock</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Help Text */}
        <div className="w-full mt-8 pt-6 border-t border-slate-200/80 dark:border-zinc-800/80 flex flex-col gap-2.5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 dark:text-zinc-500 text-[11px]">
            <Smartphone size={13} className="shrink-0" />
            <span>Native Android Biometric Security</span>
          </div>

          <p className={cn(
            "text-[11px] leading-relaxed",
            theme === 'dark' ? "text-zinc-400" : "text-slate-500"
          )}>
            Your fingerprint and face data are never stored by TrackBook. Android securely handles biometric authentication on your device.
          </p>

          <p className={cn(
            "text-[11px] font-semibold",
            theme === 'dark' ? "text-zinc-300" : "text-slate-700"
          )}>
            MPIN remains available as a fallback.
          </p>
        </div>
      </main>
    </div>
  );
}
