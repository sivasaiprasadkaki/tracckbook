import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  Lock
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a session (Supabase automatically signs in the user when they click the recovery link)
    const checkSession = async () => {
      if (!supabase) {
        setChecking(false);
        return;
      }
      const res = await supabase.auth.getSession();
      const session = res?.data?.session || null;
      if (!session) {
        // If no session, they might have accessed this page directly without a recovery token
        // Or the token might have expired.
        // We can check the URL for recovery tokens too, but Supabase usually handles this.
        const hash = window.location.hash;
        if (!hash.includes('type=recovery') && !hash.includes('access_token=')) {
           setError('Invalid or expired reset link. Please request a new one.');
        }
      }
      setChecking(false);
    };
    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setLoading(false);
      setSuccess('Your password is updated and redirecting to login page...');

      // 1. Clear hash tokens from URL so App NavigationHandler does not re-route back to resetpassword
      try {
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch (_) {}

      // 2. Clear recovery session so login page opens cleanly
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn('Signout after password reset warning:', signOutErr);
      }

      // 3. Redirect to login page
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } catch (err: any) {
      console.error('Reset password error:', err);
      setLoading(false);
      setError(err.message || 'An error occurred while updating your password.');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#f3f7ff] dark:bg-slate-950 flex items-center justify-center">
        <Loader2 size={40} className="text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f3f7ff] dark:bg-black font-lora transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[400px] bg-white dark:bg-zinc-950 rounded-[32px] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-white/50 dark:border-zinc-800"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="text-indigo-600 dark:text-indigo-400" size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2">Reset Password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Please enter your new password below.
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-3 rounded-xl flex items-start gap-3 text-xs font-medium border border-rose-100 dark:border-rose-900/30">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl flex items-start gap-3 text-xs font-medium border border-emerald-100 dark:border-emerald-900/30">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl py-3 px-4 outline-none transition-all text-sm font-medium dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl py-3 px-4 outline-none transition-all text-sm font-medium dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !!success}
            className={cn(
              "w-full rounded-xl py-3.5 font-bold transition-all flex items-center justify-center gap-2 mt-4 text-white cursor-pointer",
              success 
                ? "bg-emerald-600 shadow-lg shadow-emerald-200 dark:shadow-none" 
                : "bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none",
              (loading || !!success) && "opacity-90 cursor-not-allowed"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Updating Password...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle2 size={18} />
                <span>Password Updated! Redirecting...</span>
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            type="button"
            onClick={async () => {
              try {
                if (window.location.hash) {
                  window.history.replaceState(null, '', window.location.pathname);
                }
                await supabase?.auth.signOut();
              } catch (_) {}
              window.location.href = '/login';
            }}
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-sm cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
