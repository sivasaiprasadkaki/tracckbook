import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShieldCheck,
  KeyRound,
  LockKeyhole,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  saveUserMpin,
  verifyUserMpin,
  validateMpinStrength,
  resetLockoutState,
} from '../services/mpinSecurityService';
import { supabase } from '../integrations/supabase/client';

interface CreateMpinModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  theme?: 'light' | 'dark';
}

export function CreateMpinModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
  theme = 'light',
}: CreateMpinModalProps) {
  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMpin('');
      setConfirmMpin('');
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleDigitInput =
    (setter: (value: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
      setter(value);

      if (error) {
        setError(null);
      }
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mpin.length !== 6 || confirmMpin.length !== 6) {
      setError('Please enter and confirm a 6-digit TPIN.');
      return;
    }

    if (mpin !== confirmMpin) {
      setError('TPIN and confirmation do not match.');
      return;
    }

    const validation = validateMpinStrength(mpin);

    if (!validation.isValid) {
      setError(validation.error || 'Please choose a stronger TPIN.');
      return;
    }

    setLoading(true);

    try {
      const result = await saveUserMpin(userId, mpin);

      if (!result.success) {
        setError(result.error || 'Failed to create TPIN.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create TPIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn(
            'fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300',
            theme === 'dark' ? 'bg-black/80' : 'bg-slate-900/60'
          )}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={cn(
              'w-full max-w-sm p-6 shadow-2xl transition-colors duration-300 relative border',
              theme === 'dark'
                ? 'bg-zinc-950 border-zinc-800'
                : 'bg-white border-slate-200'
            )}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-indigo-600 text-white">
                <ShieldCheck size={22} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Create TPIN
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Create a secure 6-digit TPIN
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2">
                <AlertCircle
                  size={15}
                  className="shrink-0 mt-0.5 text-rose-500"
                />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Create TPIN
                </label>

                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={mpin}
                  onChange={handleDigitInput(setMpin)}
                  placeholder="••••••"
                  autoComplete="off"
                  className={cn(
                    'w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none',
                    theme === 'dark'
                      ? 'bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600'
                  )}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Confirm TPIN
                </label>

                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmMpin}
                  onChange={handleDigitInput(setConfirmMpin)}
                  placeholder="••••••"
                  autoComplete="off"
                  className={cn(
                    'w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none',
                    theme === 'dark'
                      ? 'bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600'
                  )}
                />
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className={cn(
                    'flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider border transition-colors',
                    theme === 'dark'
                      ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  )}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    mpin.length !== 6 ||
                    confirmMpin.length !== 6
                  }
                  className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Create TPIN'
                  )}
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
  onOpenForgotMpin: () => void;
  theme?: 'light' | 'dark';
}

export function ChangeMpinModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
  onOpenForgotMpin,
  theme = 'light',
}: ChangeMpinModalProps) {
  const [currentMpin, setCurrentMpin] = useState('');
  const [newMpin, setNewMpin] = useState('');
  const [confirmNewMpin, setConfirmNewMpin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentMpin('');
      setNewMpin('');
      setConfirmNewMpin('');
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleDigitInput =
    (setter: (value: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
      setter(value);

      if (error) {
        setError(null);
      }
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      currentMpin.length !== 6 ||
      newMpin.length !== 6 ||
      confirmNewMpin.length !== 6
    ) {
      setError('Please enter all 6-digit TPIN fields.');
      return;
    }

    if (newMpin !== confirmNewMpin) {
      setError('New TPIN and confirmation do not match.');
      return;
    }

    const validCurrent = await verifyUserMpin(userId, currentMpin);

    if (!validCurrent.success) {
      setError(validCurrent.error || 'Current TPIN is incorrect.');
      return;
    }

    const validation = validateMpinStrength(newMpin);

    if (!validation.isValid) {
      setError(validation.error || 'Please choose a stronger TPIN.');
      return;
    }

    setLoading(true);

    try {
      const result = await saveUserMpin(userId, newMpin);

      if (!result.success) {
        setError(result.error || 'Failed to update TPIN.');
        return;
      }

      resetLockoutState(userId);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update TPIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn(
            'fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300',
            theme === 'dark' ? 'bg-black/80' : 'bg-slate-900/60'
          )}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={cn(
              'w-full max-w-sm p-6 shadow-2xl transition-colors duration-300 relative border',
              theme === 'dark'
                ? 'bg-zinc-950 border-zinc-800'
                : 'bg-white border-slate-200'
            )}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-indigo-600 text-white">
                <KeyRound size={22} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Change TPIN
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Update your 6-digit TPIN
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2">
                <AlertCircle
                  size={15}
                  className="shrink-0 mt-0.5 text-rose-500"
                />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Current TPIN
                </label>

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
                    'w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none',
                    theme === 'dark'
                      ? 'bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600'
                  )}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenForgotMpin();
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                Forgot TPIN?
              </button>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                  New TPIN
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
                    'w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none',
                    theme === 'dark'
                      ? 'bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600'
                  )}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Confirm New TPIN
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
                    'w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none',
                    theme === 'dark'
                      ? 'bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600'
                  )}
                />
              </div>

              <div className="flex items-center gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className={cn(
                    'flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider border transition-colors',
                    theme === 'dark'
                      ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  )}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    currentMpin.length !== 6 ||
                    newMpin.length !== 6 ||
                    confirmNewMpin.length !== 6
                  }
                  className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
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

export function ForgotMpinModal({
  isOpen,
  onClose,
  userEmail,
  userId,
  onSuccess,
  theme = 'light',
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
      const { error: authError } =
        await supabase.auth.signInWithPassword({
          email: userEmail,
          password,
        });

      if (authError) {
        setError(
          authError.message ||
            'Incorrect password. Verification failed.'
        );
      } else {
        resetLockoutState(userId);
        setStep('create_new');
        setError(null);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'Verification failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNewMpin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      newMpin.length !== 6 ||
      confirmNewMpin.length !== 6
    ) {
      setError('Please provide and confirm a 6-digit TPIN.');
      return;
    }

    if (newMpin !== confirmNewMpin) {
      setError('TPIN and confirmation do not match.');
      return;
    }

    const validation = validateMpinStrength(newMpin);

    if (!validation.isValid) {
      setError(validation.error || 'Weak TPIN choice.');
      return;
    }

    setLoading(true);

    try {
      const result = await saveUserMpin(userId, newMpin);

      if (!result.success) {
        setError(
          result.error ||
            'Failed to save new TPIN.'
        );
      } else {
        setSuccess('TPIN reset successfully');

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to update TPIN.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDigitInput =
    (setter: (value: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
        .replace(/\D/g, '')
        .slice(0, 6);

      setter(value);

      if (error) {
        setError(null);
      }
    };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn(
            'fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300',
            theme === 'dark' ? 'bg-black/80' : 'bg-slate-900/60'
          )}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={cn(
              'w-full max-w-sm p-6 shadow-2xl transition-colors duration-300 relative border',
              theme === 'dark'
                ? 'bg-zinc-950 border-zinc-800'
                : 'bg-white border-slate-200'
            )}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-indigo-600 text-white">
                {step === 'verify' ? (
                  <LockKeyhole size={22} />
                ) : (
                  <ShieldCheck size={22} />
                )}
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {step === 'verify'
                    ? 'Forgot TPIN'
                    : 'Create New TPIN'}
                </h2>

                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {step === 'verify'
                    ? 'Verify your account ownership'
                    : 'Create your new 6-digit TPIN'}
                </p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2"
                >
                  <AlertCircle
                    size={15}
                    className="shrink-0 mt-0.5 text-rose-500"
                  />
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
                  <CheckCircle2
                    size={16}
                    className="shrink-0 text-emerald-500"
                  />
                  <span>{success}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {step === 'verify' ? (
              <form
                onSubmit={handleVerifyAccount}
                className="space-y-4"
              >
                <div className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-600 dark:text-zinc-300">
                  To reset your TPIN, please enter your password for account:
                  <strong className="text-slate-900 dark:text-white block mt-0.5">
                    {userEmail}
                  </strong>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                    Account Password
                  </label>

                  <div className="relative">
                    <input
                      type={
                        showPassword
                          ? 'text'
                          : 'password'
                      }
                      inputMode="text"
                      enterKeyHint="done"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);

                        if (error) {
                          setError(null);
                        }
                      }}
                      placeholder="Enter account password"
                      autoComplete="current-password"
                      className={cn(
                        'w-full pl-3.5 pr-10 py-2.5 text-sm border transition-colors outline-none',
                        theme === 'dark'
                          ? 'bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600'
                      )}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(!showPassword)
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1"
                    >
                      {showPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className={cn(
                      'flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider border transition-colors',
                      theme === 'dark'
                        ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    )}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={loading || !password}
                    className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      'Verify Ownership'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleSaveNewMpin}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                    New TPIN
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
                      'w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none',
                      theme === 'dark'
                        ? 'bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                    Confirm New TPIN
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
                      'w-full px-3.5 py-2.5 text-base tracking-[0.35em] text-center font-mono border transition-colors outline-none',
                      theme === 'dark'
                        ? 'bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600'
                    )}
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className={cn(
                      'flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider border transition-colors',
                      theme === 'dark'
                        ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    )}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      newMpin.length !== 6 ||
                      confirmNewMpin.length !== 6
                    }
                    className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      'Reset TPIN'
                    )}
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