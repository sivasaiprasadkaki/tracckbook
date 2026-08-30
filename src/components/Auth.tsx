import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Eye,
  EyeOff,
  Loader2, 
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Phone,
  Key,
  Mail,
  Smartphone
} from 'lucide-react';
import { cn } from '../lib/utils';
import { CountryCodePicker, COUNTRIES, Country } from './CountryCodePicker';
import { PhoneComingSoonModal } from './PhoneComingSoonModal';
import { markSessionUnlocked } from '../services/mpinSecurityService';
import DesktopSignIn from './DesktopSignIn';
import DesktopSignUp from './DesktopSignUp';
import DesktopForgot from './DesktopForgot';
import { handleUniversalGoogleLogin, isNativeAndroidApp } from '../services/nativeGoogleAuthService';

type AuthMode = 'signin' | 'signup' | 'forgot';

export default function Auth({ 
  theme = 'light', 
  isDesktop: isDesktopProp = false,
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
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [showPhoneComingSoon, setShowPhoneComingSoon] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxCode, setSandboxCode] = useState('');
  const [sandboxEmail, setSandboxEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isDesktop, setIsDesktop] = useState(isDesktopProp);
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('supabase_remember_me');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (isDesktopProp) return;
    const handleResize = () => {
      const largeScreen = window.innerWidth >= 1024;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsDesktop(largeScreen && !hasTouch);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDesktopProp]);

  // Clear error and success messages when the auth view/mode switches
  // but keep the url redirect messages (hash type=signup or error_code=otp_expired) on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=signup') || hash.includes('error_code=otp_expired')) {
      return;
    }
    setError(null);
    setSuccess(null);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('supabase_remember_me', rememberMe ? 'true' : 'false');
  }, [rememberMe]);

  useEffect(() => {
    // Check if user was logged out due to inactivity
    const reason = sessionStorage.getItem('logout_reason');
    if (reason === 'inactivity') {
      setError('You were logged out due to inactivity.');
      sessionStorage.removeItem('logout_reason');
    }

    // Check if user just completed password reset
    const resetSuccessMsg = sessionStorage.getItem('password_reset_success');
    if (resetSuccessMsg) {
      setSuccess(resetSuccessMsg);
      sessionStorage.removeItem('password_reset_success');
    }

    // Handle signup confirmation redirect modes
    const hash = window.location.hash || '';
    if (hash.includes('type=signup')) {
      setMode('signin');
      if (hash.includes('error_code=otp_expired') || hash.includes('error=access_denied')) {
        setError('Verification link expired. Please try signing up again or contact support.');
      } else {
        setSuccess('Email confirmed! You can now login.');
      }
    }
  }, []);

  const testConnection = async () => {
    if (!supabase) return;
    setTestingConnection(true);
    try {
      await supabase.from('cashbooks').select('id').limit(1);
    } catch (err: any) {
      console.error('Connection check failed:', err);
    } finally {
      setTestingConnection(false);
    }
  };

  const getPasswordRequirements = (pass: string) => {
    return [
      { label: '6+ characters', met: pass.length >= 6, key: 'length' },
      { label: 'Capital letter', met: /[A-Z]/.test(pass), key: 'capital' },
      { label: 'Number', met: /[0-9]/.test(pass), key: 'number' },
      { label: 'Special char', met: /[^A-Za-z0-9]/.test(pass), key: 'special' },
      { label: 'Alphabet', met: /[a-zA-Z]/.test(pass), key: 'alpha' },
    ];
  };

  const passwordReqs = getPasswordRequirements(password);
  const isPasswordStrong = passwordReqs.every(req => req.met);

  const handleSendPhoneOtp = async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    if (!phoneNumber) {
      setError('Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    // Bypass phone authentication and show coming soon modal
    setShowPhoneComingSoon(true);
    setLoading(false);
  };

  const handleVerifyPhoneOtp = async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    if (!phoneOtp) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let cleanNumber = phoneNumber.replace(/\s+/g, '');
      let formattedPhone = `${selectedCountry.dialCode}${cleanNumber}`;
      
      if (sandboxMode) {
        if (phoneOtp.trim() !== sandboxCode) {
          throw new Error('Incorrect or expired verification code (Sandbox).');
        }

        // Try to sign in with password first
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: sandboxEmail,
          password: 'PhoneLoginFallback123!',
        });

        if (signInError) {
          if (mode === 'signup') {
            // Sign up new user
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: sandboxEmail,
              password: 'PhoneLoginFallback123!',
              options: {
                data: {
                  full_name: fullName || 'Phone User',
                }
              }
            });

            if (signUpError) throw signUpError;

            // Upsert profiles
            if (signUpData?.user) {
              await supabase.from('profiles').upsert({
                id: signUpData.user.id,
                email: sandboxEmail,
                full_name: fullName || 'Phone User',
                phone: formattedPhone,
                phone_verified: true,
              }, { onConflict: 'id' });
            }
            setSuccess('Account created and logged in successfully (Sandbox)!');
          } else {
            throw signInError;
          }
        } else {
          setSuccess('Logged in successfully (Sandbox)!');
          // Sync profiles
          if (data?.user) {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email: data.user.email || null,
              full_name: data.user.user_metadata?.full_name || 'Phone User',
              phone: formattedPhone,
              phone_verified: true,
            }, { onConflict: 'id' });
          }
        }
      } else {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          phone: formattedPhone,
          token: phoneOtp.trim(),
          type: 'sms',
        });

        if (verifyError) throw verifyError;

        setSuccess('Logged in successfully!');
        if (data?.user?.id) {
          markSessionUnlocked(data.user.id);
        }
        
        // Attempt profiles table sync
        if (data?.user) {
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email: data.user.email || null,
              full_name: data.user.user_metadata?.full_name || '',
              phone: formattedPhone,
              phone_verified: true,
            }, { onConflict: 'id' });
          } catch (dbErr) {
            console.warn('Profiles table sync failed (might not exist yet):', dbErr);
          }
        }
      }
    } catch (err: any) {
      console.error('Phone OTP verification error:', err);
      setError(err.message || 'Incorrect or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    await handleUniversalGoogleLogin({
      redirectTo: typeof window !== 'undefined' ? window.location.origin : 'https://trackbook.xyz',
      onStart: () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
      },
      onSuccess: (session) => {
        setLoading(false);
        setSuccess('Logged in successfully with Google!');
        if (session?.user?.id) {
          markSessionUnlocked(session.user.id);
        }
        navigate('/cashbooks', { replace: true });
      },
      onError: (errorMessage) => {
        setLoading(false);
        setError(errorMessage || 'Google Sign-In failed.');
      },
      onCancelled: () => {
        setLoading(false);
      }
    });
  };

  const handleDemoLogin = async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    const demoEmail = 'demo@example.com';
    const demoPassword = 'DemoPassword123!';
    
    try {
      console.log('Attempting demo login...');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });
      
      if (signInError) {
        console.log('Demo user does not exist or password mismatch. Creating demo user...');
        // Let's sign up the demo user
        const { error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
          options: {
            data: {
              full_name: 'Demo Account',
            }
          }
        });
        
        if (signUpError) {
          throw signUpError;
        }
        
        // Try signin again
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });
        
        if (retryError) {
          throw retryError;
        }
      }
      setSuccess('Logged in successfully to demo session!');
      const demoUserRes = await supabase.auth.getUser();
      if (demoUserRes?.data?.user?.id) {
        markSessionUnlocked(demoUserRes.data.user.id);
      }
    } catch (err: any) {
      console.error('Demo login rescue failed:', err);
      setError(err.message || 'Demo login failed. Please try standard Sign Up instead.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSignUpAndLogin = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log('Auto-registering credentials...');
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || 'Quick User',
          }
        }
      });
      
      if (signUpError) {
        if (
          signUpError.message?.toLowerCase().includes('already registered') || 
          signUpError.message?.toLowerCase().includes('already exists') || 
          signUpError.status === 422
        ) {
          setSuccess('✅ Check your inbox.\n\nWe\'ve sent an email to your registered email address.\n\nPlease follow the instructions in your email to continue.');
          return;
        }
        throw signUpError;
      }

      // --- Console Logs requested by User ---
      console.log('[Response Security Inspection - AutoSignUp]');
      console.log(' - data:', data);
      console.log(' - data.user:', data?.user);
      console.log(' - data.user.identities:', data?.user?.identities);
      console.log(' - error:', signUpError);

      let isExistingUser = false;
      if (data?.user) {
        const identities = data.user.identities || [];
        if (identities.length === 0) {
          isExistingUser = true;
          console.log('[Signup Segregation - AutoSignUp] Existing User detected via empty identities array.');
        } else {
          const createdAt = data.user.created_at ? new Date(data.user.created_at).getTime() : 0;
          const now = Date.now();
          const timeDiffSec = Math.abs(now - createdAt) / 1000;
          console.log(`[Signup Segregation - AutoSignUp] Evaluation: timeDiffSec=${timeDiffSec}s, identitiesCount=${identities.length}`);
          if (timeDiffSec > 12) {
            isExistingUser = true;
            console.log('[Signup Segregation - AutoSignUp] Existing User detected via stale created_at time.');
          }
        }
      } else {
        isExistingUser = true;
      }

      if (isExistingUser) {
        setSuccess('✅ Check your inbox.\n\nWe\'ve sent an email to your registered email address.\n\nPlease follow the instructions in your email to continue.');
        return;
      }
      
      // Attempt login
      const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) {
        if (signInError.message?.includes('Email not confirmed')) {
          setSuccess('Account registered! If confirmation is required, please check your inbox.');
        } else {
          throw signInError;
        }
      } else {
        if (signInData?.user?.id) {
          markSessionUnlocked(signInData.user.id);
        }
        setSuccess('Account registered and logged in successfully!');
      }
    } catch (err: any) {
      console.error('Auto signup failed:', err);
      setError(err.message || 'Failed to auto-register account. Please use the Sign Up tab.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loginMethod === 'phone') {
      if (!phoneOtpSent) {
        await handleSendPhoneOtp();
      } else {
        await handleVerifyPhoneOtp();
      }
      return;
    }
    
    // Auto-login for testing if credentials match provided ones (Optional, but helps user)
    if (email === 'sivasaiprasadkaki@gmail.com' && password === 'Siva@123') {
       console.log('Using test credentials...');
    }

    if (!supabase) {
      setError('Supabase is not configured. Please check your environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).');
      return;
    }
    
    if (mode === 'signup') {
      if (!isPasswordStrong) {
        setError('Please meet all password requirements');
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
    
    console.log(`Attempting ${mode} for ${email}...`);

    const redirectTo = window.location.origin;

    try {
      if (mode === 'signup') {
        console.log('Signing up...');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              full_name: fullName,
            },
          },
        });
        
        // --- Console Logs requested by User ---
        console.log('[Response Security Inspection - SignUp] signUp returned:');
        console.log(' - data:', data);
        console.log(' - data.user:', data?.user);
        console.log(' - data.user.identities:', data?.user?.identities);
        console.log(' - error:', error);

        if (error) {
          if (
            error.message?.toLowerCase().includes('already registered') || 
            error.message?.toLowerCase().includes('already exists') || 
            error.status === 422
          ) {
            setSuccess('✅ Check your inbox.\n\nWe\'ve sent an email to your registered email address.\n\nPlease follow the instructions in your email to continue.');
            return;
          }
          throw error;
        }

        // --- Supabase Response Validation & Segregation ---
        let isExistingUser = false;
        
        if (data?.user) {
          const identities = data.user.identities || [];
          
          // 1. If identities array is empty, GoTrue is suppressing the identities to prevent enumeration
          if (identities.length === 0) {
            isExistingUser = true;
            console.log('[Signup Segregation] Existing User detected via empty identities array.');
          } else {
            // 2. If identities has elements, check if the account is older than 12 seconds
            const createdAt = data.user.created_at ? new Date(data.user.created_at).getTime() : 0;
            const now = Date.now();
            const timeDiffSec = Math.abs(now - createdAt) / 1000;
            console.log(`[Signup Segregation] Evaluation: timeDiffSec=${timeDiffSec}s, identitiesCount=${identities.length}`);
            
            if (timeDiffSec > 12) {
              isExistingUser = true;
              console.log('[Signup Segregation] Existing User detected via stale created_at time (stale unconfirmed or confirmed user info).');
            }
          }
        } else {
          // If no user is returned, it shouldn't be counted as a success
          console.log('[Signup Segregation] Sign up did not return a user object.');
          isExistingUser = true;
        }

        if (isExistingUser) {
          setSuccess('✅ Check your inbox.\n\nWe\'ve sent an email to your registered email address.\n\nPlease follow the instructions in your email to continue.');
          return;
        }

        console.log('[Signup Segregation] Genuinely New User signed up.');
        setSuccess('Account created! Please check your email for verification.');

      } else if (mode === 'signin') {
        console.log('Signing in...');
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          const isCredsError = error.message?.toLowerCase().includes('invalid login credentials') || 
                               error.message?.toLowerCase().includes('invalid_credential') || 
                               error.message?.toLowerCase().includes('invalid_creds');
          if (!isCredsError) {
            console.error('SignIn Error Details:', error);
          } else {
            console.log('SignIn expected credential failure:', error.message);
          }
          throw error;
        }
        if (data?.user?.id) {
          markSessionUnlocked(data.user.id);
        }
        console.log('SignIn Success:', data);
      } else if (mode === 'forgot') {
        const isAndroid = isNativeAndroidApp();
        const redirectTo = isAndroid 
          ? 'trackbook://reset-password' 
          : `${window.location.origin}/resetpassword`;

        console.log('[Auth] Password Reset - Platform:', isAndroid ? 'Android Native' : 'Web/Desktop', 'RedirectTo:', redirectTo);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo
        });

        if (error) {
          console.error('SUPABASE RESET PASSWORD ERROR:', error);
          setError(error.message);
          return;
        }

        setSuccess('Password reset link sent successfully. Check your email.');
      }
    } catch (err: any) {
      const isCredsError = err.message?.toLowerCase().includes('invalid login credentials') || 
                           err.message?.toLowerCase().includes('invalid_credential') || 
                           err.message?.toLowerCase().includes('invalid_creds');
      if (!isCredsError) {
        console.error('Auth error:', err);
      } else {
        console.log('Auth expected credential error:', err.message);
      }
      if (mode === 'forgot') {
        setError(err.message || 'An error occurred while sending the recovery email.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Email not confirmed. Please check your inbox or spam folder for the verification link.');
      } else if (
        err.message?.toLowerCase().includes('invalid login credentials') || 
        err.message?.toLowerCase().includes('invalid credential') ||
        err.message?.toLowerCase().includes('invalid_creds')
      ) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isDesktop) {
    if (mode === 'signin') {
      return (
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
      );
    } else if (mode === 'signup') {
      return (
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
      );
    } else {
      return (
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
      );
    }
  }

  return (
    <div className={cn(
      isDesktop ? "min-h-screen w-full flex items-center justify-center p-0 md:p-6 transition-colors duration-300" : "w-full h-screen h-[100dvh] max-h-screen max-h-[100dvh] flex flex-col justify-center items-center p-0 transition-colors duration-300",
      theme === 'dark' ? "bg-[#030303]" : "bg-[#f8f9fd]"
    )}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "w-full flex flex-col relative font-sans text-slate-900 transition-colors duration-300",
          isDesktop 
            ? "max-w-[414px] min-h-[850px] max-h-[900px] rounded-none shadow-[0_24px_60px_rgba(66,18,222,0.12)] border border-slate-200/50 bg-[#f8f9fd] dark:bg-[#030303] overflow-y-auto overflow-x-hidden" 
            : "h-full max-h-screen h-[100dvh] max-h-[100dvh] max-w-md p-4 sm:p-6 overflow-y-auto overflow-x-hidden bg-transparent"
        )}
      >
        {/* Top gradient decorative bubble */}
        <div className={cn("absolute top-0 left-0 w-full h-[250px] bg-gradient-to-b from-[#5b3df5]/8 to-transparent -z-10 pointer-events-none", isDesktop ? "rounded-none" : "rounded-b-[40px]")} />

        {/* Back navigation header (Only on Register and Forgot pages) */}
        {mode !== 'signin' && (
          <header className={cn("flex items-center w-full shrink-0 z-10", isDesktop ? "px-5 h-16" : "px-4 h-12")}>
            <button
              onClick={() => setMode('signin')}
              className={cn("p-2 -ml-2 hover:bg-slate-200/50 dark:hover:bg-zinc-850 transition-colors active:scale-95 text-slate-800 dark:text-zinc-200 cursor-pointer bg-transparent border-none outline-none", isDesktop ? "rounded-none" : "rounded-full")}
            >
              <ArrowLeft size={20} className="stroke-[2.5px]" />
            </button>
          </header>
        )}

        <div className={cn(
          "flex-1 flex flex-col justify-center",
          isDesktop ? "pt-2 pb-6" : "py-0"
        )}>
          {/* Main Error & Success Alerts */}
          <div className={cn("px-5", !isDesktop && "px-4 mb-2")}>
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn("bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 flex flex-col gap-1.5 text-xs font-semibold overflow-hidden shadow-sm mb-4", isDesktop ? "rounded-none" : "rounded-2xl")}
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                    <span className="flex-1 leading-relaxed">{error}</span>
                  </div>
                  
                  {mode === 'signin' && (error.includes('Incorrect email or password') || error.includes('INVALID_CREDS')) && email && password && (
                    <div className="mt-2 pt-2 border-t border-rose-200/50">
                      <p className="text-[10px] text-rose-700 mb-1.5 leading-normal font-bold">
                        💡 Account not found or wrong password?
                      </p>
                      <button
                        type="button"
                        onClick={handleAutoSignUpAndLogin}
                        className={cn("w-full bg-rose-600 hover:bg-rose-700 text-white py-2 px-3 font-bold text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer border-none", isDesktop ? "rounded-none" : "rounded-xl")}
                      >
                        ✨ Create Account & Login instantly
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn("bg-emerald-50 border border-emerald-100 text-emerald-600 px-4 py-3 flex items-start gap-2 text-xs font-semibold overflow-hidden shadow-sm mb-4", isDesktop ? "rounded-none" : "rounded-2xl")}
                >
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-500" />
                  <span className="whitespace-pre-line flex-1">{success}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* SCREEN 1: LOGIN MODE */}
          {mode === 'signin' && (
            <div className="flex-1 flex flex-col justify-center">
              {/* Header block */}
              <div className={cn("text-center px-5", isDesktop ? "mt-6 mb-1" : "mt-2 mb-1")}>
                <h1 className={cn(
                  "font-extrabold tracking-tight leading-tight",
                  isDesktop ? "text-[28px] text-slate-900" : "text-2xl text-slate-900 dark:text-white"
                )}>Welcome Back</h1>
                <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">Manage your cashbooks securely.</p>
              </div>

              {/* Central Illustration */}
              <div className={cn(
                "w-full relative flex justify-center items-center shrink-0",
                isDesktop ? "h-40 my-6" : "h-20 my-3"
              )}>
                {/* Diagonal floating soft shape */}
                <div className={cn(
                  "rounded-full bg-gradient-to-tr from-[#4212de]/90 to-[#5b3df5]/90 shadow-xl shadow-indigo-600/15 absolute -ml-12 animate-[bounce_5s_infinite]",
                  isDesktop ? "w-28 h-28" : "w-16 h-16"
                )} />
                
                {/* Document Ledger mockup */}
                <div className={cn(
                  "rounded-2xl bg-white shadow-xl absolute rotate-12 flex flex-col backdrop-blur-md bg-white/80 border border-white/40",
                  isDesktop ? "w-20 h-26 p-3.5 gap-2" : "w-12 h-16 p-2 gap-1"
                )}>
                  <div className="w-full h-1 bg-[#4212de]/20 rounded-full" />
                  <div className="w-3/4 h-1 bg-[#4212de]/10 rounded-full" />
                  <div className="mt-auto w-full h-4 bg-gradient-to-r from-[#4212de] to-[#5b3df5] rounded opacity-85" />
                </div>
                
                {/* Accent mini circle */}
                <div className={cn(
                  "rounded-full bg-[#ded9fd]/90 absolute animate-[bounce_4s_infinite_reverse]",
                  isDesktop ? "w-12 h-12 ml-20 -mt-10" : "w-8 h-8 ml-12 -mt-6"
                )} />
              </div>

              {/* Login Credentials Card */}
              <div className={cn(
                "bg-white dark:bg-zinc-900/50 shadow-[0_4px_30px_rgba(66,18,222,0.03)] border border-slate-100 dark:border-zinc-800/80 p-5 sm:p-6 mx-4 sm:mx-5",
                isDesktop ? "mb-6 rounded-none" : "mb-3 rounded-[28px]"
              )}>
                <form onSubmit={handleAuth} className="space-y-3.5">
                  {/* Email field */}
                  <div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      className={cn("w-full px-4 py-3 bg-[#f8f9fd] dark:bg-zinc-950 border border-[#c8c4d9] dark:border-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-[#4212de] focus:ring-1 focus:ring-[#4212de] transition-colors font-medium", isDesktop ? "rounded-none" : "rounded-xl")}
                    />
                  </div>

                  {/* Password field with eye toggle */}
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className={cn("w-full pl-4 pr-12 py-3 bg-[#f8f9fd] dark:bg-zinc-950 border border-[#c8c4d9] dark:border-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-[#4212de] focus:ring-1 focus:ring-[#4212de] transition-colors font-medium", isDesktop ? "rounded-none" : "rounded-xl")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#4212de] transition-colors p-1 bg-transparent border-none outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="flex justify-end pr-1">
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs font-bold text-[#4212de] dark:text-[#7d5bf7] hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={cn("w-full bg-[#4212de] hover:bg-[#340eb3] text-white font-bold py-3 shadow-[0_8px_30px_rgba(66,18,222,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border-none outline-none mt-1", isDesktop ? "rounded-none" : "rounded-xl")}
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Sign In"}
                  </button>

                  {/* Divider */}
                  <div className="flex items-center py-1">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-800" />
                    <span className="px-3 text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-800" />
                  </div>

                  {/* Google OAuth Button */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className={cn("w-full bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border border-[#c8c4d9] dark:border-zinc-800 font-bold py-3 flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-zinc-850 active:scale-[0.98] transition-all cursor-pointer", isDesktop ? "rounded-none" : "rounded-xl")}
                  >
                    <svg fill="none" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                      <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.89 16.79 15.72 17.57V20.33H19.29C21.37 18.41 22.56 15.59 22.56 12.25Z" fill="#4285F4"></path>
                      <path d="M12 23C14.97 23 17.46 22.02 19.29 20.33L15.72 17.57C14.73 18.23 13.47 18.64 12 18.64C9.15 18.64 6.74 16.71 5.88 14.12H2.19V16.98C4.01 20.61 7.7 23 12 23Z" fill="#34A853"></path>
                      <path d="M5.88 14.12C5.66 13.46 5.54 12.74 5.54 12C5.54 11.26 5.66 10.54 5.88 9.88V7.02H2.19C1.45 8.5 1 10.19 1 12C1 13.81 1.45 15.5 2.19 16.98L5.88 14.12Z" fill="#FBBC05"></path>
                      <path d="M12 5.36C13.62 5.36 15.07 5.92 16.21 7.02L19.37 3.86C17.45 2.07 14.97 1 12 1C7.7 1 4.01 3.39 2.19 7.02L5.88 9.88C6.74 7.29 9.15 5.36 12 5.36Z" fill="#EA4335"></path>
                    </svg>
                    Google
                  </button>
                </form>
              </div>

              {/* Footer Register Link */}
              <div className="mt-2 pb-2 text-center shrink-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Don't have an account?
                  <button
                    onClick={() => setMode('signup')}
                    className="font-bold text-[#4212de] dark:text-[#7d5bf7] hover:underline ml-1.5 bg-transparent border-none cursor-pointer text-xs sm:text-sm"
                  >
                    Create Account
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* SCREEN 2: REGISTER MODE */}
          {mode === 'signup' && (
            <div className="flex-1 flex flex-col justify-center">
              {/* Header Box */}
              <div className={cn("px-5 text-left", isDesktop ? "mb-5" : "mb-3")}>
                {/* Soft Bank Rounded Box */}
                <div className={cn(
                  "bg-[#5b3df5] flex items-center justify-center shadow-[0_8px_30px_rgba(66,18,222,0.15)] text-white",
                  isDesktop ? "w-14 h-14 mb-4 rounded-none" : "w-10 h-10 mb-2 rounded-2xl"
                )}>
                  <svg className={isDesktop ? "w-7 h-7" : "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h1 className={cn(
                  "font-extrabold text-slate-900 dark:text-white leading-tight",
                  isDesktop ? "text-[26px]" : "text-xl sm:text-2xl"
                )}>Create Your Account</h1>
                <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">Start managing your finances today.</p>
              </div>

              {/* Registration Card */}
              <div className={cn(
                "bg-white dark:bg-zinc-900/50 shadow-[0_4px_30px_rgba(66,18,222,0.03)] border border-slate-100 dark:border-zinc-800/80 p-5 sm:p-6 mx-4 sm:mx-5",
                isDesktop ? "mb-6 rounded-none" : "mb-3 rounded-[28px]"
              )}>
                <form onSubmit={handleAuth} className="space-y-3">
                  {/* Full Name */}
                  <div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full Name"
                      className={cn("w-full px-4 py-2.5 bg-[#f8f9fd] dark:bg-zinc-950 border border-[#c8c4d9] dark:border-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-[#4212de] focus:ring-1 focus:ring-[#4212de] transition-colors font-medium", isDesktop ? "rounded-none" : "rounded-xl")}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className={cn("w-full px-4 py-2.5 bg-[#f8f9fd] dark:bg-zinc-950 border border-[#c8c4d9] dark:border-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-[#4212de] focus:ring-1 focus:ring-[#4212de] transition-colors font-medium", isDesktop ? "rounded-none" : "rounded-xl")}
                    />
                  </div>

                  {/* Password */}
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className={cn("w-full pl-4 pr-12 py-2.5 bg-[#f8f9fd] dark:bg-zinc-950 border border-[#c8c4d9] dark:border-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-[#4212de] focus:ring-1 focus:ring-[#4212de] transition-colors font-medium", isDesktop ? "rounded-none" : "rounded-xl")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#4212de] transition-colors p-1 bg-transparent border-none outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Confirm Password */}
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                      className={cn("w-full pl-4 pr-12 py-2.5 bg-[#f8f9fd] dark:bg-zinc-950 border border-[#c8c4d9] dark:border-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-[#4212de] focus:ring-1 focus:ring-[#4212de] transition-colors font-medium", isDesktop ? "rounded-none" : "rounded-xl")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#4212de] transition-colors p-1 bg-transparent border-none outline-none cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Terms checkbox */}
                  <div className="flex items-center py-0.5">
                    <input
                      type="checkbox"
                      id="terms"
                      required
                      className={cn("w-4 h-4 border-slate-300 text-[#4212de] focus:ring-[#4212de] bg-transparent cursor-pointer", isDesktop ? "rounded-none" : "rounded")}
                    />
                    <label htmlFor="terms" className="ml-2.5 text-xs text-slate-500 dark:text-zinc-400 font-semibold cursor-pointer select-none">
                      I agree to <span className="text-[#4212de] dark:text-[#7d5bf7] font-bold hover:underline">Terms</span> &amp; <span className="text-[#4212de] dark:text-[#7d5bf7] font-bold hover:underline">Privacy</span>
                    </label>
                  </div>

                  {/* Register button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={cn("w-full bg-[#4212de] hover:bg-[#340eb3] text-white font-bold py-3 shadow-[0_8px_30px_rgba(66,18,222,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border-none outline-none mt-1", isDesktop ? "rounded-none" : "rounded-xl")}
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Create Account"}
                  </button>

                  {/* Divider */}
                  <div className="flex items-center py-1">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-800" />
                    <span className="px-3 text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-800" />
                  </div>

                  {/* Google signup button */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className={cn("w-full bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border border-[#c8c4d9] dark:border-zinc-800 font-bold py-2.5 flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-zinc-850 active:scale-[0.98] transition-all cursor-pointer", isDesktop ? "rounded-none" : "rounded-xl")}
                  >
                    <svg fill="none" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                      <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.89 16.79 15.72 17.57V20.33H19.29C21.37 18.41 22.56 15.59 22.56 12.25Z" fill="#4285F4"></path>
                      <path d="M12 23C14.97 23 17.46 22.02 19.29 20.33L15.72 17.57C14.73 18.23 13.47 18.64 12 18.64C9.15 18.64 6.74 16.71 5.88 14.12H2.19V16.98C4.01 20.61 7.7 23 12 23Z" fill="#34A853"></path>
                      <path d="M5.88 14.12C5.66 13.46 5.54 12.74 5.54 12C5.54 11.26 5.66 10.54 5.88 9.88V7.02H2.19C1.45 8.5 1 10.19 1 12C1 13.81 1.45 15.5 2.19 16.98L5.88 14.12Z" fill="#FBBC05"></path>
                      <path d="M12 5.36C13.62 5.36 15.07 5.92 16.21 7.02L19.37 3.86C17.45 2.07 14.97 1 12 1C7.7 1 4.01 3.39 2.19 7.02L5.88 9.88C6.74 7.29 9.15 5.36 12 5.36Z" fill="#EA4335"></path>
                    </svg>
                    Google
                  </button>
                </form>
              </div>

              {/* Sign In Footer Link */}
              <div className="mt-2 pb-2 text-center shrink-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Already have an account?
                  <button
                    onClick={() => setMode('signin')}
                    className="font-bold text-[#4212de] dark:text-[#7d5bf7] hover:underline ml-1.5 bg-transparent border-none cursor-pointer text-xs sm:text-sm"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* SCREEN 3: FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <div className="flex-1 flex flex-col justify-center">
              <div>
                {/* Center Image Illustration */}
                <div className={cn("flex justify-center", isDesktop ? "mt-4 mb-6" : "mt-2 mb-3")}>
                  <div className={cn(
                    "relative overflow-hidden bg-indigo-50 dark:bg-zinc-900 flex items-center justify-center p-0.5 shadow-sm",
                    isDesktop ? "w-40 h-40 rounded-none" : "w-24 h-24 rounded-full"
                  )}>
                    <img
                      className={cn("w-full h-full object-cover", isDesktop ? "rounded-none" : "rounded-full")}
                      alt="Forgot Password illustration"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_bq3fUpU7IqvHnwyxH1OROgQknC668PAgbPYm5C4MdpHhM5y5AOMHwExnYzFSCTJFTsOf9TLs824M6mYRJGLgoyyC7nKBXKHlLEfyCWdj6mVL9csFCRE5IdJfu-Ytlcg7xzx-Mpq2hf5Jhnm4wK3SIWbbsU1PeEYRTO2zicoleB0d6HFXyrzuH2Fq33HfIAhQnXib36LlrtPVEor3bnOlQ1uL7NVFTT1w8cGC-QbRtZNi6vQbvv14STPyZdVnhnpdnOnoVDv6wdc"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                {/* Typography */}
                <div className="text-center px-6 mb-4">
                  <h1 className={cn(
                    "font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight",
                    isDesktop ? "text-[26px]" : "text-xl sm:text-2xl"
                  )}>Forgot Password?</h1>
                  <p className="text-xs sm:text-sm font-medium text-slate-500 mt-2 px-2 leading-relaxed">
                    Enter your email to receive a password reset link.
                  </p>
                </div>

                {/* Form Block */}
                <form onSubmit={handleAuth} className="space-y-4 px-6">
                  {/* Outlined email input with envelope leading icon */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
                      <Mail size={18} />
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Address"
                      className={cn("w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-950 border border-[#c8c4d9] dark:border-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-[#4212de] focus:ring-1 focus:ring-[#4212de] transition-colors font-medium", isDesktop ? "rounded-none" : "rounded-xl")}
                    />
                  </div>

                  {/* Send link button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={cn("w-full bg-[#4212de] hover:bg-[#340eb3] text-white font-bold py-3 shadow-[0_8px_30px_rgba(66,18,222,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border-none outline-none mt-4", isDesktop ? "rounded-none" : "rounded-xl")}
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Send Reset Link"}
                  </button>
                </form>
              </div>

              {/* Back to login footer link */}
              <div className={cn("text-center shrink-0", isDesktop ? "pb-6 mt-12" : "pb-2 mt-6")}>
                <button
                  onClick={() => setMode('signin')}
                  className="font-bold text-[#4212de] dark:text-[#7d5bf7] hover:underline text-xs sm:text-sm bg-transparent border-none cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Phone Coming Soon Modal */}
      <AnimatePresence>
        {showPhoneComingSoon && (
          <PhoneComingSoonModal
            isOpen={showPhoneComingSoon}
            onClose={() => setShowPhoneComingSoon(false)}
            type="login"
            theme={theme === 'dark' ? 'dark' : 'light'}
            onContinueWithGmail={handleGoogleLogin}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

