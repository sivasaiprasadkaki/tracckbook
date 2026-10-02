import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import DesktopSignIn from './DesktopSignIn';
import DesktopSignUp from './DesktopSignUp';
import DesktopForgot from './DesktopForgot';

type AuthMode = 'signin' | 'signup' | 'forgot';

export default function Auth({ 
  theme = 'light', 
  isDesktop = false,
  onRecoveryComplete 
}: { 
  theme?: string;
  isDesktop?: boolean;
  onRecoveryComplete?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const mode: AuthMode = (location.pathname === '/register' || location.pathname === '/signup') 
    ? 'signup' 
    : (location.pathname === '/forgot' ? 'forgot' : 'signin');

  const setMode = (newMode: AuthMode) => {
    if (newMode === 'signup') {
      navigate('/signup');
    } else if (newMode === 'forgot') {
      navigate('/forgot');
    } else {
      navigate('/login');
    }
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Clear messages on mode switch
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [mode]);

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const redirectTo = window.location.origin;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setError(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supabase) {
      setError('Supabase is not configured. Please check your environment variables.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const redirectTo = window.location.origin;

    try {
      if (mode === 'signup') {
        const trimmedName = fullName.trim();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              full_name: trimmedName,
              name: trimmedName,
              username: trimmedName,
              user_name: trimmedName,
            },
          },
        });

        if (error) {
          if (
            error.message?.toLowerCase().includes('already registered') || 
            error.message?.toLowerCase().includes('already exists') || 
            (error as any).status === 422
          ) {
            setError('This email is already registered. Please sign in or use Forgot Password.');
            return;
          }
          throw error;
        }

        // Create initial profile if possible (without overwriting if already exists)
        if (data?.user && trimmedName) {
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email: email.trim(),
              full_name: trimmedName,
            }, { onConflict: 'id' });
          } catch (_) {}
        }

        setError(null);
        setSuccess('Check your inbox! Verification email has been sent. Please check your inbox (and spam folder) to activate your account.');

        // Attempt login immediately
        try {
          const { error: autoSignInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (!autoSignInError) {
            navigate('/cashbooks');
          }
        } catch (_) {}

      } else if (mode === 'signin') {
        const { error, data } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          throw error;
        }

        // Sync profile only if user exists and we have valid data (never overwrite valid existing name with empty/null)
        if (data?.user) {
          try {
            const meta = data.user.user_metadata || {};
            const metaName = meta.full_name || meta.name || meta.username || meta.user_name || meta.preferred_username;
            const profilePayload: any = {
              id: data.user.id,
              email: data.user.email || email.trim(),
            };
            if (metaName && String(metaName).trim()) {
              profilePayload.full_name = String(metaName).trim();
            }
            await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
          } catch (_) {}
        }

        setSuccess('Logged in successfully!');
        navigate('/cashbooks');

      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/resetpassword`
        });

        if (error) {
          setError(error.message);
          return;
        }

        setSuccess('Password reset link sent successfully. Check your email.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const isCredsError = err.message?.toLowerCase().includes('invalid login credentials') || 
                           err.message?.toLowerCase().includes('invalid credential') || 
                           err.message?.toLowerCase().includes('invalid_creds');
      if (mode === 'forgot') {
        setError(err.message || 'An error occurred while sending the recovery email.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Email not confirmed. Please check your inbox or spam folder for the verification link.');
      } else if (isCredsError) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {mode === 'signin' && (
        <motion.div
          key="signin-page"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full min-h-screen"
        >
          <DesktopSignIn
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            loading={loading}
            error={error}
            success={success}
            handleAuth={handleAuth}
            handleGoogleLogin={handleGoogleLogin}
            setMode={setMode}
            navigate={navigate}
          />
        </motion.div>
      )}

      {mode === 'signup' && (
        <motion.div
          key="signup-page"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full min-h-screen"
        >
          <DesktopSignUp
            fullName={fullName}
            setFullName={setFullName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            loading={loading}
            error={error}
            success={success}
            handleAuth={handleAuth}
            handleGoogleLogin={handleGoogleLogin}
            setMode={setMode}
            navigate={navigate}
          />
        </motion.div>
      )}

      {mode === 'forgot' && (
        <motion.div
          key="forgot-page"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full min-h-screen"
        >
          <DesktopForgot
            email={email}
            setEmail={setEmail}
            loading={loading}
            error={error}
            success={success}
            setSuccess={setSuccess}
            handleAuth={handleAuth}
            setMode={setMode}
            navigate={navigate}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
