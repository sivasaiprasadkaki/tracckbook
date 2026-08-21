import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Lock, KeyRound, X, CheckCircle2, AlertCircle, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { 
  validateMpinStrength, 
  saveUserMpin, 
  verifyUserMpin, 
  resetLockoutState 
} from '../services/mpinSecurityService';

interface CreateMpinModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  theme?: 'light' | 'dark';
}

/**
 * Modal for creating a new 6-digit MPIN
 */
export function CreateMpinModal({ isOpen, onClose, userId, onSuccess, theme = 'light' }: CreateMpinModalProps) {
  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMpin('');
      setConfirmMpin('');
      setError(null);
      setSuccess(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mpin.length !== 6) {
      setError('Please enter a full 6-digit MPIN.');
      return;
    }

    if (confirmMpin.length !== 6) {
      setError('Please confirm your 6-digit MPIN.');
      return;
    }

    if (mpin !== confirmMpin) {
      setError('MPIN and Confirm MPIN do not match.');
      return;
    }

    const validation = validateMpinStrength(mpin);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid MPIN strength.');
      return;
    }

    setLoading(true);
    try {
      const res = await saveUserMpin(userId, mpin);
      if (!res.success) {
        setError(res.error || 'Failed to save MPIN.');
      } else {
        setSuccess('MPIN created successfully');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigitInput = (setter: (val: string) => void, currentVal: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setter(val);
    if (error) setError(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={cn(
          "fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
          theme === 'dark' ? "bg-black/75" : "bg-slate-900/50"
        )}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={cn(
              "w-full max-w-sm p-6 shadow-2xl transition-colors duration-300 relative border",
              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-900 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-600 flex items-center justify-center text-white shrink-0">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">Create your MPIN</h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">6-digit mobile security PIN</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error / Success Feedback */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2"
                >
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                  <span>{error}</span>
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2"
                >
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                  <span>{success}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* MPIN input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                  MPIN (6 Digits)
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={mpin}
                    onChange={handleDigitInput(setMpin, mpin)}
                    placeholder="••••••"
                    autoComplete="off"
                    className={cn(
                      "w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none",
                      theme === 'dark' 
                        ? "bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500" 
                        : "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600"
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {mpin.length}/6
                  </div>
                </div>
              </div>

              {/* Confirm MPIN input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Confirm MPIN
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={confirmMpin}
                    onChange={handleDigitInput(setConfirmMpin, confirmMpin)}
                    placeholder="••••••"
                    autoComplete="off"
                    className={cn(
                      "w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none",
                      theme === 'dark' 
                        ? "bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500" 
                        : "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600"
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {confirmMpin.length}/6
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                Avoid simple combinations like 123456, 000000, or repeating digits.
              </p>

              {/* Actions */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className={cn(
                    "flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider border transition-colors",
                    theme === 'dark' 
                      ? "border-zinc-800 hover:bg-zinc-900 text-zinc-300" 
                      : "border-slate-300 hover:bg-slate-100 text-slate-700"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || mpin.length !== 6 || confirmMpin.length !== 6}
                  className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Create MPIN"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface ChangeMpinModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  onOpenForgotMpin?: () => void;
  theme?: 'light' | 'dark';
}

/**
 * Modal for changing an existing MPIN
 */
export function ChangeMpinModal({ 
  isOpen, 
  onClose, 
  userId, 
  onSuccess, 
  onOpenForgotMpin,
  theme = 'light' 
}: ChangeMpinModalProps) {
  const [currentMpin, setCurrentMpin] = useState('');
  const [newMpin, setNewMpin] = useState('');
  const [confirmNewMpin, setConfirmNewMpin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentMpin('');
      setNewMpin('');
      setConfirmNewMpin('');
      setError(null);
      setSuccess(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (currentMpin.length !== 6) {
      setError('Please enter your 6-digit Current MPIN.');
      return;
    }

    if (newMpin.length !== 6) {
      setError('Please enter your 6-digit New MPIN.');
      return;
    }

    if (confirmNewMpin.length !== 6) {
      setError('Please confirm your 6-digit New MPIN.');
      return;
    }

    if (newMpin !== confirmNewMpin) {
      setError('New MPIN and Confirmation do not match.');
      return;
    }

    if (currentMpin === newMpin) {
      setError('New MPIN cannot be the same as your Current MPIN.');
      return;
    }

    const validation = validateMpinStrength(newMpin);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid New MPIN strength.');
      return;
    }

    setLoading(true);
    try {
      // 1. Verify Current MPIN
      const verifyRes = await verifyUserMpin(userId, currentMpin);
      if (!verifyRes.success) {
        setError(verifyRes.error || 'Current MPIN is incorrect.');
        setLoading(false);
        return;
      }

      // 2. Save New MPIN
      const saveRes = await saveUserMpin(userId, newMpin);
      if (!saveRes.success) {
        setError(saveRes.error || 'Failed to update MPIN.');
      } else {
        setSuccess('MPIN changed successfully');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while changing MPIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigitInput = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setter(val);
    if (error) setError(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={cn(
          "fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
          theme === 'dark' ? "bg-black/75" : "bg-slate-900/50"
        )}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={cn(
              "w-full max-w-sm p-6 shadow-2xl transition-colors duration-300 relative border",
              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-900 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-600 flex items-center justify-center text-white shrink-0">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">Change your MPIN</h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Update existing 6-digit security PIN</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error / Success Feedback */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2"
                >
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                  <span>{error}</span>
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2"
                >
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                  <span>{success}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleChange} className="space-y-3.5">
              {/* Current MPIN */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Current MPIN
                  </label>
                  {onOpenForgotMpin && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenForgotMpin();
                      }}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Forgot MPIN?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={currentMpin}
                  onChange={handleDigitInput(setCurrentMpin)}
                  placeholder="••••••"
                  autoComplete="off"
                  className={cn(
                    "w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none",
                    theme === 'dark' 
                      ? "bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500" 
                      : "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600"
                  )}
                />
              </div>

              {/* New MPIN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                  New MPIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={newMpin}
                  onChange={handleDigitInput(setNewMpin)}
                  placeholder="••••••"
                  autoComplete="off"
                  className={cn(
                    "w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none",
                    theme === 'dark' 
                      ? "bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500" 
                      : "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600"
                  )}
                />
              </div>

              {/* Confirm New MPIN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Confirm New MPIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmNewMpin}
                  onChange={handleDigitInput(setConfirmNewMpin)}
                  placeholder="••••••"
                  autoComplete="off"
                  className={cn(
                    "w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none",
                    theme === 'dark' 
                      ? "bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500" 
                      : "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600"
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className={cn(
                    "flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider border transition-colors",
                    theme === 'dark' 
                      ? "border-zinc-800 hover:bg-zinc-900 text-zinc-300" 
                      : "border-slate-300 hover:bg-slate-100 text-slate-700"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || currentMpin.length !== 6 || newMpin.length !== 6 || confirmNewMpin.length !== 6}
                  className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface ForgotMpinModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
  onSuccess: () => void;
  theme?: 'light' | 'dark';
}

/**
 * Modal for resetting MPIN after proving account ownership via existing TrackBook login credentials
 */
export function ForgotMpinModal({
  isOpen,
  onClose,
  userEmail,
  userId,
  onSuccess,
  theme = 'light'
}: ForgotMpinModalProps) {
  const [step, setStep] = useState<'verify' | 'create_new'>('verify');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newMpin, setNewMpin] = useState('');
  const [confirmNewMpin, setConfirmNewMpin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('verify');
      setPassword('');
      setShowPassword(false);
      setNewMpin('');
      setConfirmNewMpin('');
      setError(null);
      setSuccess(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleVerifyAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter your account password to verify ownership.');
      return;
    }

    setLoading(true);
    try {
      // Re-authenticate user with Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password,
      });

      if (authError) {
        setError(authError.message || 'Incorrect password. Verification failed.');
      } else {
        // Verification succeeded!
        resetLockoutState(userId);
        setStep('create_new');
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNewMpin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newMpin.length !== 6 || confirmNewMpin.length !== 6) {
      setError('Please provide and confirm a 6-digit MPIN.');
      return;
    }

    if (newMpin !== confirmNewMpin) {
      setError('MPIN and Confirmation do not match.');
      return;
    }

    const validation = validateMpinStrength(newMpin);
    if (!validation.isValid) {
      setError(validation.error || 'Weak MPIN choice.');
      return;
    }

    setLoading(true);
    try {
      const res = await saveUserMpin(userId, newMpin);
      if (!res.success) {
        setError(res.error || 'Failed to save new MPIN.');
      } else {
        setSuccess('MPIN reset successfully');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update MPIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigitInput = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setter(val);
    if (error) setError(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={cn(
          "fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
          theme === 'dark' ? "bg-black/80" : "bg-slate-900/60"
        )}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={cn(
              "w-full max-w-sm p-6 shadow-2xl transition-colors duration-300 relative border",
              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-900 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-600 flex items-center justify-center text-white shrink-0">
                  <RefreshCw size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">
                    {step === 'verify' ? 'Forgot MPIN' : 'Set New MPIN'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                    {step === 'verify' ? 'Verify TrackBook Account' : 'Choose 6-digit MPIN'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error / Success Feedback */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2"
                >
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                  <span>{error}</span>
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2"
                >
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                  <span>{success}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {step === 'verify' ? (
              <form onSubmit={handleVerifyAccount} className="space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-600 dark:text-zinc-300">
                  To reset your MPIN, please enter your password for account: <strong className="text-slate-900 dark:text-white block mt-0.5">{userEmail}</strong>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                    Account Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Enter account password"
                      autoComplete="current-password"
                      className={cn(
                        "w-full pl-3.5 pr-10 py-2.5 text-sm border transition-colors outline-none",
                        theme === 'dark' 
                          ? "bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500" 
                          : "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className={cn(
                      "flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider border transition-colors",
                      theme === 'dark' 
                        ? "border-zinc-800 hover:bg-zinc-900 text-zinc-300" 
                        : "border-slate-300 hover:bg-slate-100 text-slate-700"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !password}
                    className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : "Verify Ownership"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveNewMpin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                    New MPIN (6 Digits)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={newMpin}
                    onChange={handleDigitInput(setNewMpin)}
                    placeholder="••••••"
                    autoComplete="off"
                    className={cn(
                      "w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none",
                      theme === 'dark' 
                        ? "bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500" 
                        : "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600"
                    )}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                    Confirm New MPIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={confirmNewMpin}
                    onChange={handleDigitInput(setConfirmNewMpin)}
                    placeholder="••••••"
                    autoComplete="off"
                    className={cn(
                      "w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none",
                      theme === 'dark' 
                        ? "bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500" 
                        : "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600"
                    )}
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className={cn(
                      "flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider border transition-colors",
                      theme === 'dark' 
                        ? "border-zinc-800 hover:bg-zinc-900 text-zinc-300" 
                        : "border-slate-300 hover:bg-slate-100 text-slate-700"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || newMpin.length !== 6 || confirmNewMpin.length !== 6}
                    className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : "Save New MPIN"}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
