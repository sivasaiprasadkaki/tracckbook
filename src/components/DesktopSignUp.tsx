import React, { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

interface DesktopSignUpProps {
  fullName: string;
  setFullName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  showPassword: boolean;
  setShowPassword: (val: boolean) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (val: boolean) => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  handleAuth: (e: React.FormEvent) => void;
  handleGoogleLogin: () => void;
  setMode: (mode: 'signin' | 'signup' | 'forgot') => void;
  navigate: (path: string) => void;
}

export default function DesktopSignUp({
  fullName,
  setFullName,
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  confirmPassword,
  setConfirmPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  loading,
  error,
  success,
  handleAuth,
  handleGoogleLogin,
  setMode,
  navigate
}: DesktopSignUpProps) {
  // Typing animation for full name placeholder
  const [typedPlaceholder, setTypedPlaceholder] = useState('');
  const targetText = 'Siva Sai Prasad';

  useEffect(() => {
    let index = 0;
    let isDeleting = false;
    let timer: any;

    const tick = () => {
      if (!isDeleting) {
        setTypedPlaceholder(targetText.substring(0, index + 1));
        index++;
        if (index === targetText.length) {
          isDeleting = true;
          timer = setTimeout(tick, 2000);
          return;
        }
      } else {
        setTypedPlaceholder(targetText.substring(0, index - 1));
        index--;
        if (index === 0) {
          isDeleting = false;
          timer = setTimeout(tick, 500);
          return;
        }
      }
      timer = setTimeout(tick, isDeleting ? 60 : 120);
    };

    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, []);

  // Password strength calculation
  const getStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 6) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strength = getStrength(password);

  const getStrengthLabel = () => {
    if (!password) return '';
    if (strength <= 1) return 'Weak';
    if (strength === 2) return 'Fair';
    if (strength === 3) return 'Good';
    return 'Strong';
  };

  const getStrengthColor = () => {
    if (strength <= 1) return 'bg-rose-500';
    if (strength === 2) return 'bg-amber-500';
    if (strength === 3) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="min-h-screen bg-[#fbf8ff] text-[#1b1a23] antialiased flex flex-col lg:flex-row selection:bg-[#4648d4]/15 selection:text-[#4648d4] font-['Inter',sans-serif]">
      <style>{`
        .float-slow {
          animation: floatSlow 6s ease-in-out infinite;
        }
        .float-fast {
          animation: floatFast 4.5s ease-in-out infinite;
        }
        .progress-pulse {
          animation: pulseWidth 3s ease-in-out infinite;
        }
        .badge-pop {
          animation: badgePop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes floatFast {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pulseWidth {
          0%, 100% { width: 92%; }
          50% { width: 100%; }
        }
        @keyframes badgePop {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Left Visual Showcase (Desktop) */}
      <div className="hidden lg:flex w-1/2 bg-[#e8eafc] relative flex-col justify-center items-center p-12 overflow-hidden select-none font-['Inter',sans-serif]">
        {/* Ambient Glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#4648d4]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#8455ef]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Central Dashboard Mockup Card */}
        <div className="relative z-10 w-full max-w-md flex flex-col gap-6">
          {/* Main Balance Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-lg flex flex-col gap-4 float-slow font-['Inter',sans-serif]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#4648d4]/10 text-[#4648d4] flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1b1a23] text-sm font-['Inter',sans-serif]">Primary Cashbook</h4>
                  <p className="text-xs text-[#464554] font-['Inter',sans-serif]">Personal & Business</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 font-['Inter',sans-serif]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>

            <div className="pt-2">
              <p className="text-xs font-semibold text-[#464554] uppercase tracking-wider font-['Inter',sans-serif]">Total Tracked Balance</p>
              <h3 className="text-4xl font-bold text-[#4648d4] tracking-tight mt-1 font-['JetBrains_Mono',monospace]">
                ₹42,500<span className="text-2xl text-[#4648d4]/70">.00</span>
              </h3>
            </div>
          </div>

          {/* Staggered Expense Pills */}
          <div className="flex flex-col gap-3 relative font-['Inter',sans-serif]">
            <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between transform -rotate-1 hover:rotate-0 transition-transform duration-300">
              <div className="flex items-center gap-3">
                <span className="text-lg">✈️</span>
                <span className="text-sm font-medium text-[#1b1a23] font-['Inter',sans-serif]">Travel & Flights</span>
              </div>
              <span className="text-sm font-semibold font-['JetBrains_Mono',monospace] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">-₹12,400.00</span>
            </div>

            <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between transform translate-x-3 rotate-1 hover:translate-x-0 hover:rotate-0 transition-all duration-300">
              <div className="flex items-center gap-3">
                <span className="text-lg">💻</span>
                <span className="text-sm font-medium text-[#1b1a23] font-['Inter',sans-serif]">Software & Subscriptions</span>
              </div>
              <span className="text-sm font-semibold font-['JetBrains_Mono',monospace] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">-₹8,250.00</span>
            </div>

            <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between transform -translate-x-2 -rotate-1 hover:translate-x-0 hover:rotate-0 transition-all duration-300">
              <div className="flex items-center gap-3">
                <span className="text-lg">🍴</span>
                <span className="text-sm font-medium text-[#1b1a23] font-['Inter',sans-serif]">Dining & Meals</span>
              </div>
              <span className="text-sm font-semibold font-['JetBrains_Mono',monospace] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">-₹4,120.00</span>
            </div>
          </div>

          {/* Progress / Status Block */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md flex flex-col gap-3 float-fast font-['Inter',sans-serif]">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-[#464554] flex items-center gap-1.5 font-['Inter',sans-serif]">
                <span className="material-symbols-outlined text-sm text-[#4648d4]">auto_awesome</span>
                Expense Categorization
              </span>
              <span className="text-[#4648d4] font-['JetBrains_Mono',monospace]">100%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-[#4648d4] to-[#8455ef] h-full rounded-full progress-pulse" />
            </div>
          </div>

          {/* Status Badge */}
          <div className="bg-[#4648d4] text-white p-4 rounded-xl flex items-center gap-3 justify-center shadow-lg shadow-[#4648d4]/20 badge-pop">
            <span className="material-symbols-outlined text-xl">check_circle</span>
            <span className="text-sm font-semibold tracking-wide font-['Inter',sans-serif]">Dashboard Ready for Real-Time Tracking</span>
          </div>
        </div>
      </div>

      {/* Right Form Section */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 lg:p-16 min-h-screen bg-[#fbf8ff] font-['Inter',sans-serif]">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8">
          <div 
            onClick={() => navigate('/')} 
            className="w-10 h-10 rounded-xl bg-[#4648d4] flex items-center justify-center text-white shadow-md shadow-[#4648d4]/20 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-2xl">menu_book</span>
          </div>
          <span 
            onClick={() => navigate('/')} 
            className="text-xl font-bold tracking-tight text-[#4648d4] cursor-pointer font-['Hanken_Grotesk',sans-serif]"
          >
            TrackBook
          </span>
        </div>

        {/* Main Content Area */}
        <div className="max-w-md w-full mx-auto my-auto py-4">
          <div className="mb-6">
            <h1 className="text-3xl lg:text-4xl font-bold text-[#1b1a23] tracking-tight leading-tight font-['Hanken_Grotesk',sans-serif]">
              Build your financial command center
            </h1>
            <p className="mt-2 text-[15px] text-[#464554] leading-relaxed font-normal font-['Inter',sans-serif]">
              Create your TrackBook account and start turning everyday expenses into clear financial insights.
            </p>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3 animate-fade-in font-['Inter',sans-serif]">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 whitespace-pre-line">{error}</div>
            </div>
          )}

          {success && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3 animate-fade-in font-['Inter',sans-serif]">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              <div className="flex-1 whitespace-pre-line">{success}</div>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-['Inter',sans-serif]">
                FULL NAME
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={fullName ? '' : (typedPlaceholder || 'Enter your name')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/20 outline-none text-sm bg-white transition-all text-[#1b1a23] placeholder-slate-400 font-['Inter',sans-serif]"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-['Inter',sans-serif]">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="siva@gmail.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/20 outline-none text-sm bg-white transition-all text-[#1b1a23] placeholder-slate-400 font-['Inter',sans-serif]"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-['Inter',sans-serif]">
                PASSWORD
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-300 focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/20 outline-none text-sm bg-white transition-all text-[#1b1a23] placeholder-slate-400 font-['Inter',sans-serif]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1.5 font-['Inter',sans-serif]">
                  <div className="flex items-center justify-between text-[11px] font-medium text-[#464554]">
                    <span>Password Strength</span>
                    <span className="font-semibold">{getStrengthLabel()}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 h-1.5">
                    <div className={`rounded-full h-full transition-all ${strength >= 1 ? getStrengthColor() : 'bg-slate-200'}`} />
                    <div className={`rounded-full h-full transition-all ${strength >= 2 ? getStrengthColor() : 'bg-slate-200'}`} />
                    <div className={`rounded-full h-full transition-all ${strength >= 3 ? getStrengthColor() : 'bg-slate-200'}`} />
                    <div className={`rounded-full h-full transition-all ${strength >= 4 ? getStrengthColor() : 'bg-slate-200'}`} />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-['Inter',sans-serif]">
                CONFIRM PASSWORD
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-300 focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/20 outline-none text-sm bg-white transition-all text-[#1b1a23] placeholder-slate-400 font-['Inter',sans-serif]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#4648d4] to-[#6052a8] text-white font-semibold text-xs tracking-wider uppercase shadow-md shadow-[#4648d4]/25 hover:shadow-lg hover:shadow-[#4648d4]/35 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed font-['Inter',sans-serif]"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-[#fbf8ff] px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest font-['Inter',sans-serif]">
                OR
              </span>
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-white border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99] transition-all flex items-center justify-center gap-3 shadow-sm cursor-pointer disabled:opacity-60 font-['Inter',sans-serif]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>

          {/* Footer Navigation Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[#464554] font-['Inter',sans-serif]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  navigate('/login');
                }}
                className="font-semibold text-[#4648d4] hover:underline cursor-pointer bg-transparent border-none p-0 inline font-['Inter',sans-serif]"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
