import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete, AlertCircle, Loader2, ShieldCheck, RefreshCw, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  verifyUserMpin, 
  getLockoutSecondsRemaining, 
  getFailedAttemptsCount 
} from '../services/mpinSecurityService';
import { ForgotMpinModal } from './MpinModals';
import { supabase } from '../lib/supabase';

interface MpinLockScreenProps {
  userId: string;
  userEmail: string;
  userName?: string;
  onUnlock: () => void;
  theme?: 'light' | 'dark';
}

export function MpinLockScreen({ 
  userId, 
  userEmail, 
  userName,
  onUnlock, 
  theme = 'light' 
}: MpinLockScreenProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Check lockout countdown
  useEffect(() => {
    const checkLockout = () => {
      const remaining = getLockoutSecondsRemaining(userId);
      setLockoutRemaining(remaining);
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [userId]);

  // Haptic feedback helper
  const triggerHaptic = (pattern: number | number[] = 10) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibration errors
      }
    }
  };

  const handleKeyPress = (num: string) => {
    if (lockoutRemaining > 0 || isVerifying) return;
    triggerHaptic(10);
    setError(null);
    if (digits.length < 6) {
      setDigits((prev) => [...prev, num]);
    }
  };

  const handleBackspace = () => {
    if (lockoutRemaining > 0 || isVerifying) return;
    triggerHaptic(10);
    setError(null);
    setDigits((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (lockoutRemaining > 0 || isVerifying) return;
    triggerHaptic(15);
    setError(null);
    setDigits([]);
  };

  const submitMpin = useCallback(async (mpinToTest: string) => {
    if (mpinToTest.length !== 6 || isVerifying || lockoutRemaining > 0) return;

    setIsVerifying(true);
    setError(null);

    try {
      const res = await verifyUserMpin(userId, mpinToTest);
      if (res.success) {
        triggerHaptic(30);
        onUnlock();
      } else {
        triggerHaptic([40, 40, 40]);
        setError(res.error || 'Incorrect MPIN. Please try again.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        setDigits([]);
        
        const remaining = getLockoutSecondsRemaining(userId);
        if (remaining > 0) {
          setLockoutRemaining(remaining);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Verification error. Please retry.');
      setDigits([]);
    } finally {
      setIsVerifying(false);
    }
  }, [userId, isVerifying, lockoutRemaining, onUnlock]);

  // Auto-submit when 6 digits are typed
  useEffect(() => {
    if (digits.length === 6) {
      submitMpin(digits.join(''));
    }
  }, [digits, submitMpin]);

  // Handle hardware keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isForgotModalOpen || lockoutRemaining > 0 || isVerifying) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [digits, isForgotModalOpen, lockoutRemaining, isVerifying]);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (err) {
      console.error('Sign out error:', err);
      window.location.reload();
    }
  };

  return (
    <div className={cn(
      "fixed inset-0 z-[9999] flex flex-col justify-between w-full h-full min-h-[100dvh] select-none p-5 sm:p-8 transition-colors duration-300 font-sans",
      theme === 'dark' ? "bg-[#09090b] text-white" : "bg-[#f8f9fd] text-slate-900"
    )}>
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Lock size={18} />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight uppercase">TrackBook Security</h1>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
              {userName || userEmail || 'Verified Session'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-colors"
          title="Sign out of TrackBook"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>

      {/* Center Main Lock Card */}
      <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-center my-auto py-2">
        <motion.div
          animate={isShaking ? { x: [-10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full flex flex-col items-center"
        >
          {/* Welcome & Instruction */}
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">
              Enter your 6-digit MPIN to unlock
            </p>
          </div>

          {/* 6 Digit Masked Indicator */}
          <div className="flex items-center justify-center gap-3.5 mb-6 py-2">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const isFilled = idx < digits.length;
              return (
                <div
                  key={idx}
                  className={cn(
                    "w-4 h-4 transition-all duration-200 flex items-center justify-center",
                    isFilled 
                      ? "bg-indigo-600 scale-110 shadow-[0_0_12px_rgba(79,70,229,0.5)]" 
                      : theme === 'dark'
                        ? "bg-zinc-800 border border-zinc-700" 
                        : "bg-slate-200 border border-slate-300"
                  )}
                  style={{ borderRadius: '0px' }}
                />
              );
            })}
          </div>

          {/* Lockout or Error Status Notification */}
          <div className="min-h-[44px] w-full flex items-center justify-center mb-2 px-2">
            {lockoutRemaining > 0 ? (
              <div className="w-full p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                <AlertCircle size={15} className="text-amber-500 shrink-0" />
                <span>Locked for security: Try again in {lockoutRemaining}s</span>
              </div>
            ) : error ? (
              <div className="w-full p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold text-center flex items-center justify-center gap-2">
                <AlertCircle size={15} className="text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            ) : isVerifying ? (
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                <Loader2 size={16} className="animate-spin" />
                <span>Verifying MPIN...</span>
              </div>
            ) : null}
          </div>

          {/* Custom On-Screen Numeric Keypad */}
          <div className="w-full grid grid-cols-3 gap-2.5 sm:gap-3 max-w-[280px] sm:max-w-[300px] mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                disabled={lockoutRemaining > 0 || isVerifying}
                className={cn(
                  "h-14 sm:h-16 text-xl sm:text-2xl font-bold font-mono transition-all active:scale-95 flex items-center justify-center border select-none cursor-pointer",
                  theme === 'dark'
                    ? "bg-zinc-900/90 border-zinc-800 hover:bg-zinc-800 text-white active:bg-zinc-700"
                    : "bg-white border-slate-200 hover:bg-slate-100 text-slate-900 shadow-sm active:bg-slate-200",
                  lockoutRemaining > 0 && "opacity-40 cursor-not-allowed"
                )}
              >
                {num}
              </button>
            ))}

            {/* Clear button */}
            <button
              type="button"
              onClick={handleClear}
              disabled={lockoutRemaining > 0 || isVerifying || digits.length === 0}
              className={cn(
                "h-14 sm:h-16 text-xs uppercase font-bold tracking-wider transition-all active:scale-95 flex items-center justify-center border select-none cursor-pointer",
                theme === 'dark'
                  ? "bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-800 text-zinc-400"
                  : "bg-slate-100/70 border-slate-200 hover:bg-slate-200 text-slate-600",
                (lockoutRemaining > 0 || digits.length === 0) && "opacity-30 cursor-not-allowed"
              )}
            >
              Clear
            </button>

            {/* Zero */}
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              disabled={lockoutRemaining > 0 || isVerifying}
              className={cn(
                "h-14 sm:h-16 text-xl sm:text-2xl font-bold font-mono transition-all active:scale-95 flex items-center justify-center border select-none cursor-pointer",
                theme === 'dark'
                  ? "bg-zinc-900/90 border-zinc-800 hover:bg-zinc-800 text-white active:bg-zinc-700"
                  : "bg-white border-slate-200 hover:bg-slate-100 text-slate-900 shadow-sm active:bg-slate-200",
                lockoutRemaining > 0 && "opacity-40 cursor-not-allowed"
              )}
            >
              0
            </button>

            {/* Backspace */}
            <button
              type="button"
              onClick={handleBackspace}
              disabled={lockoutRemaining > 0 || isVerifying || digits.length === 0}
              className={cn(
                "h-14 sm:h-16 transition-all active:scale-95 flex items-center justify-center border select-none cursor-pointer",
                theme === 'dark'
                  ? "bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-800 text-zinc-300"
                  : "bg-slate-100/70 border-slate-200 hover:bg-slate-200 text-slate-700",
                (lockoutRemaining > 0 || digits.length === 0) && "opacity-30 cursor-not-allowed"
              )}
            >
              <Delete size={20} />
            </button>
          </div>

          {/* Unlock action button (Manual trigger fallback) */}
          <button
            type="button"
            onClick={() => submitMpin(digits.join(''))}
            disabled={digits.length !== 6 || isVerifying || lockoutRemaining > 0}
            className="w-full max-w-[280px] sm:max-w-[300px] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest disabled:opacity-40 transition-all flex items-center justify-center gap-2 mb-4"
          >
            {isVerifying ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <span>Unlock TrackBook</span>
            )}
          </button>
        </motion.div>
      </div>

      {/* Bottom Footer with Forgot MPIN */}
      <div className="w-full text-center pb-2">
        <button
          type="button"
          onClick={() => setIsForgotModalOpen(true)}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 p-2"
        >
          <RefreshCw size={13} />
          <span>Forgot MPIN?</span>
        </button>
      </div>

      {/* Forgot MPIN Modal */}
      <ForgotMpinModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        userEmail={userEmail}
        userId={userId}
        onSuccess={() => {
          setIsForgotModalOpen(false);
          onUnlock();
        }}
        theme={theme}
      />
    </div>
  );
}
