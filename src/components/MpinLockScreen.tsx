import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, AlertCircle, RefreshCw, LogOut, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  verifyUserMpin, 
  getLockoutSecondsRemaining 
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
  const [pinValue, setPinValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mobile / mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

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

  const verifyAndUnlock = async (pinToVerify: string) => {
    if (isVerifying || lockoutRemaining > 0 || isSuccess) return;

    setIsVerifying(true);
    setError(null);
    triggerHaptic(15);

    try {
      const res = await verifyUserMpin(userId, pinToVerify);

      if (res.success) {
        // Successful verification -> trigger Green Tick animation and auto unlock
        setIsSuccess(true);
        triggerHaptic([30, 60]);
        setTimeout(() => {
          onUnlock();
        }, 750);
      } else {
        triggerHaptic([40, 40, 40]);
        setError(res.error || 'Incorrect TPIN. Please try again.');
        setIsShaking(true);
        setPinValue('');
        setTimeout(() => {
          setIsShaking(false);
          inputRef.current?.focus();
        }, 500);

        const remaining = getLockoutSecondsRemaining(userId);
        if (remaining > 0) {
          setLockoutRemaining(remaining);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Verification error. Please retry.');
      setPinValue('');
      inputRef.current?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (lockoutRemaining > 0 || isVerifying || isSuccess) return;
    const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPinValue(raw);
    setError(null);
    triggerHaptic(8);

    // When all 6 digits are filled, automatically verify and unlock
    if (raw.length === 6) {
      verifyAndUnlock(raw);
    }
  };

  const handleBoxesClick = () => {
    if (lockoutRemaining > 0 || isVerifying || isSuccess) return;
    inputRef.current?.focus();
    setIsInputFocused(true);
  };

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

  const digits = pinValue.split('');

  return (
    <div 
      onClick={handleBoxesClick}
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col justify-between w-full h-full min-h-[100dvh] select-none p-5 sm:p-8 transition-colors duration-300 font-sans",
        theme === 'dark' ? "bg-[#09090b] text-white" : "bg-[#f8f9fd] text-slate-900"
      )}
    >
      {/* Hidden Mobile Native Numeric Keyboard Input */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={pinValue}
        onChange={handleInputChange}
        onFocus={() => setIsInputFocused(true)}
        onBlur={() => setIsInputFocused(false)}
        autoComplete="one-time-code"
        className="absolute opacity-0 pointer-events-none -top-96 left-0 w-1 h-1"
        disabled={lockoutRemaining > 0 || isVerifying || isSuccess}
      />

      {/* Top Header */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full flex items-center justify-between pt-2 z-10"
      >
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
          onClick={(e) => {
            e.stopPropagation();
            handleSignOut();
          }}
          disabled={isLoggingOut}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-colors cursor-pointer"
          title="Sign out of TrackBook"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </motion.div>

      {/* Center Main Lock Card */}
      <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-center my-auto py-4">
        <motion.div
          animate={isShaking ? { x: [-12, 12, -9, 9, -5, 5, 0] } : { x: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full flex flex-col items-center"
        >
          {/* Welcome & Instruction */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="text-center mb-6"
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1.5">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">
              Enter your 6-digit TPIN to unlock
            </p>
          </motion.div>

          {/* Dynamic Interactive Box Area / Merging into Green Tick Animation */}
          <div className="relative w-full flex items-center justify-center py-6 min-h-[140px]">
            <AnimatePresence mode="wait">
              {isSuccess ? (
                /* 6 Boxes Merged into Green Tick with Success Ripple & Particle Glow */
                <motion.div
                  key="merged-green-tick"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 22,
                    duration: 0.5 
                  }}
                  className="relative flex flex-col items-center justify-center gap-3"
                >
                  {/* Glowing background ripple */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.8 }}
                    animate={{ scale: [0.8, 1.6, 2], opacity: [0.7, 0.3, 0] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: "easeOut" }}
                    className="absolute w-20 h-20 bg-emerald-500/25 rounded-full pointer-events-none"
                  />

                  <motion.div
                    initial={{ scale: 0.4, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 450, damping: 20 }}
                    className="relative w-20 h-20 bg-gradient-to-tr from-emerald-600 to-emerald-400 rounded-3xl flex items-center justify-center text-white shadow-[0_8px_30px_rgba(16,185,129,0.5)] border-2 border-emerald-300/40"
                  >
                    <CheckCircle2 size={44} className="stroke-[2.5] text-white" />
                  </motion.div>

                  <motion.span 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400"
                  >
                    Unlocked
                  </motion.span>
                </motion.div>
              ) : (
                /* 6 Interactive Input Boxes (Horizontal Row) - Merge towards center when verifying */
                <motion.div 
                  key="pin-boxes"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ 
                    scale: 0.3, 
                    opacity: 0,
                    transition: { duration: 0.25, ease: "easeInOut" }
                  }}
                  className="flex items-center justify-center gap-2.5 sm:gap-3.5 w-full cursor-pointer"
                  onClick={handleBoxesClick}
                >
                  {[0, 1, 2, 3, 4, 5].map((idx) => {
                    const isFilled = idx < digits.length;
                    const isCurrentFocus = idx === digits.length && isInputFocused;

                    // Calculate offset toward center (2.5 is the center pivot between idx 2 and 3)
                    const offsetFromCenter = idx - 2.5;

                    return (
                      <motion.div
                        key={idx}
                        whileTap={{ scale: 0.94 }}
                        animate={
                          isVerifying 
                            ? { 
                                x: -offsetFromCenter * 30, 
                                scale: 0.85,
                                opacity: 0.9,
                                transition: { duration: 0.3, ease: "easeInOut" }
                              }
                            : isFilled 
                              ? { scale: [1, 1.12, 1], x: 0 } 
                              : { scale: 1, x: 0 }
                        }
                        transition={{ duration: 0.2 }}
                        className={cn(
                          "w-12 h-14 sm:w-13 sm:h-16 flex items-center justify-center text-xl sm:text-2xl font-mono font-bold transition-all duration-200 relative border-2",
                          isVerifying
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            : isFilled
                              ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-[0_4px_12px_rgba(79,70,229,0.15)]"
                              : isCurrentFocus
                                ? "border-indigo-500 bg-white dark:bg-zinc-900 shadow-[0_0_12px_rgba(99,102,241,0.35)] ring-2 ring-indigo-500/20"
                                : theme === 'dark'
                                  ? "border-zinc-800 bg-zinc-900/90 text-zinc-600 hover:border-zinc-700"
                                  : "border-slate-300 bg-white text-slate-400 hover:border-slate-400 shadow-sm"
                        )}
                        style={{ borderRadius: '8px' }}
                      >
                        {isFilled ? (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            className={cn(
                              "w-3.5 h-3.5 rounded-full shadow-sm",
                              isVerifying 
                                ? "bg-emerald-600 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                                : "bg-indigo-600 dark:bg-indigo-400"
                            )}
                          />
                        ) : isCurrentFocus ? (
                          <motion.span
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ repeat: Infinity, duration: 0.9 }}
                            className="w-0.5 h-6 bg-indigo-600 dark:bg-indigo-400"
                          />
                        ) : (
                          <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-full" />
                        )}

                        {/* Box index hint */}
                        <span className="absolute bottom-1 right-1 text-[8px] font-bold text-slate-300 dark:text-zinc-700 select-none">
                          {idx + 1}
                        </span>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Feedback & Error Messages */}
          <div className="min-h-[44px] w-full flex items-center justify-center my-2 px-2">
            <AnimatePresence mode="wait">
              {lockoutRemaining > 0 ? (
                <motion.div 
                  key="lockout"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="w-full p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-bold text-center flex items-center justify-center gap-2"
                >
                  <AlertCircle size={15} className="text-amber-500 shrink-0" />
                  <span>Locked for security: Try again in {lockoutRemaining}s</span>
                </motion.div>
              ) : error ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="w-full p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold text-center flex items-center justify-center gap-2"
                >
                  <AlertCircle size={15} className="text-rose-500 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              ) : isVerifying ? (
                <motion.div 
                  key="verifying"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                >
                  <Sparkles size={14} className="animate-spin text-emerald-500" />
                  <span>Verifying and unlocking...</span>
                </motion.div>
              ) : (
                <p className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 text-center">
                  Tap boxes to enter your 6-digit TPIN
                </p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Bottom Footer with Forgot TPIN */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full text-center pb-2 z-10"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsForgotModalOpen(true);
          }}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 p-2 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Forgot TPIN?</span>
        </button>
      </motion.div>

      {/* Forgot TPIN Modal */}
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
