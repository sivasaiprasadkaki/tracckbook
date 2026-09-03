import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

interface DesktopSignInProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  showPassword: boolean;
  setShowPassword: (val: boolean) => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  handleAuth: (e: React.FormEvent) => void;
  handleGoogleLogin: () => void;
  setMode: (mode: 'signin' | 'signup' | 'forgot') => void;
  navigate: (path: string) => void;
}

export default function DesktopSignIn({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  loading,
  error,
  success,
  handleAuth,
  handleGoogleLogin,
  setMode,
  navigate
}: DesktopSignInProps) {
  const [rememberMe, setRememberMe] = useState(true);

  return (
    <div className="min-h-screen bg-[#fbf8ff] text-[#1b1a23] antialiased flex flex-col justify-between selection:bg-[#4648d4]/15 selection:text-[#4648d4] font-['Inter',sans-serif]">
      <style>{`
        .pulse-ring {
          box-shadow: 0 0 0 0 rgba(132, 85, 239, 0.4);
          animation: pulseRing 2.5s infinite cubic-bezier(0.66, 0, 0, 1);
        }
        @keyframes pulseRing {
          to {
            box-shadow: 0 0 0 16px rgba(132, 85, 239, 0);
          }
        }
        .float-card {
          animation: floatCard 5s ease-in-out infinite;
        }
        @keyframes floatCard {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      {/* Top Header */}
      <motion.header 
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full px-6 sm:px-12 py-5 flex items-center justify-between"
      >
        <motion.div 
          onClick={() => navigate('/')} 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 cursor-pointer select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-[#4648d4] flex items-center justify-center text-white shadow-md shadow-[#4648d4]/20 hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-2xl">menu_book</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#4648d4] font-['Hanken_Grotesk',sans-serif]">
            TrackBook
          </span>
        </motion.div>
      </motion.header>

      {/* Main Split Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 max-w-7xl mx-auto w-full items-center px-4 sm:px-8 py-4 lg:py-8 gap-8">
        {/* Left Illustration Column (Desktop) */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:flex flex-col justify-center items-center relative p-10 lg:p-12 bg-slate-900 rounded-3xl overflow-hidden text-white shadow-2xl min-h-[560px] select-none"
        >
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#4648d4]/25 rounded-full blur-[100px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#8455ef]/20 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

          {/* Floating Expense Card Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative z-10 w-full max-w-sm flex flex-col gap-5 float-card font-['Inter',sans-serif]"
          >
            {/* Top Summary Card */}
            <div className="bg-white/10 backdrop-blur-md border border-white/15 p-6 rounded-2xl shadow-xl">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase font-['Inter',sans-serif]">
                    TOTAL EXPENSES
                  </span>
                  <div className="text-3xl font-bold tracking-tight text-white mt-1 font-['JetBrains_Mono',monospace]">
                    ₹12,450<span className="text-xl text-white/70">.00</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#8455ef]/30 text-[#8455ef] border border-[#8455ef]/40 flex items-center justify-center pulse-ring">
                  <span className="material-symbols-outlined text-xl text-indigo-200">receipt_long</span>
                </div>
              </div>

              {/* Sparkline Curve */}
              <div className="pt-2">
                <svg className="w-full h-12 stroke-indigo-300 fill-none" viewBox="0 0 300 60">
                  <motion.path
                    d="M 0 45 C 50 30, 80 50, 130 20 C 180 -5, 230 40, 300 15"
                    strokeWidth="3"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.4, ease: "easeInOut", delay: 0.3 }}
                  />
                  <path
                    d="M 0 45 C 50 30, 80 50, 130 20 C 180 -5, 230 40, 300 15 L 300 60 L 0 60 Z"
                    fill="rgba(132, 85, 239, 0.15)"
                    stroke="none"
                  />
                </svg>
              </div>
            </div>

            {/* Transaction Rows */}
            <div className="space-y-2.5 font-['Inter',sans-serif]">
              {[
                { icon: '🛒', title: 'Groceries & Supermarket', time: 'Today, 2:30 PM', amount: '-₹3,240.00' },
                { icon: '☁️', title: 'AWS Cloud Services', time: 'Yesterday', amount: '-₹4,500.00' },
                { icon: '🚗', title: 'Uber Rides', time: 'Aug 12', amount: '-₹850.00' }
              ].map((item, idx) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.25 + idx * 0.1 }}
                  whileHover={{ scale: 1.02, x: 4 }}
                  className="bg-white/10 backdrop-blur-md border border-white/10 p-3.5 rounded-xl flex items-center justify-between hover:bg-white/15 transition-all cursor-default"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <div className="text-xs font-semibold text-white">{item.title}</div>
                      <div className="text-[10px] text-slate-400">{item.time}</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-['JetBrains_Mono',monospace] text-rose-300">{item.amount}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Right Form Column */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-center px-4 sm:px-10 lg:px-12 py-6"
        >
          <div className="max-w-md w-full mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6"
            >
              <h1 className="text-3xl sm:text-[34px] lg:text-[36px] font-bold tracking-tight text-[#1b1a23] leading-tight font-['Hanken_Grotesk',sans-serif]">
                Welcome back to TrackBook
              </h1>
              <p className="mt-2 text-[15px] text-[#474556] leading-relaxed font-normal font-['Inter',sans-serif]">
                Track your expenses, understand your money, and stay in control.
              </p>
            </motion.div>

            {/* Error & Success Feedback Alerts */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3 font-['Inter',sans-serif] overflow-hidden"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1 whitespace-pre-line">
                    {error.toLowerCase().includes('banned') || error.toLowerCase().includes('blocked')
                      ? "You're Blocked please contact administrator"
                      : error.toLowerCase().includes('failed to fetch') || error.toLowerCase().includes('network')
                      ? "Unable to connect to the server. Please check your internet connection and try again."
                      : error}
                  </div>
                </motion.div>
              )}

              {success && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3 font-['Inter',sans-serif] overflow-hidden"
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                  <div className="flex-1 whitespace-pre-line">{success}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.form 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              onSubmit={handleAuth} 
              className="space-y-4"
            >
              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold tracking-wider text-slate-700 uppercase mb-1.5 font-['Inter',sans-serif]">
                  EMAIL
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="siva@gmail.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/20 outline-none text-sm bg-white transition-all text-slate-900 placeholder-slate-400 font-['Inter',sans-serif]"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold tracking-wider text-slate-700 uppercase font-['Inter',sans-serif]">
                    PASSWORD
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      navigate('/forgot');
                    }}
                    className="text-xs font-semibold text-[#4648d4] hover:underline cursor-pointer bg-transparent border-none p-0 font-['Inter',sans-serif]"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-300 focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/20 outline-none text-sm bg-white transition-all text-slate-900 placeholder-slate-400 font-['Inter',sans-serif]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#4648d4] focus:ring-[#4648d4] border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-600 font-['Inter',sans-serif]">Remember me</span>
                </label>
              </div>

              {/* Sign In Submit Button */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.985 }}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#4648d4] to-[#6052a8] text-white font-semibold text-xs tracking-wider uppercase shadow-md shadow-[#4648d4]/25 hover:shadow-lg hover:shadow-[#4648d4]/35 hover:brightness-105 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed font-['Inter',sans-serif]"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </motion.button>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-[#fbf8ff] px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest font-['Inter',sans-serif]">
                  OR
                </span>
              </div>

              {/* Google Login Button */}
              <motion.button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.985 }}
                className="w-full py-3 px-4 rounded-xl bg-white border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 hover:border-slate-400 transition-all flex items-center justify-center gap-3 shadow-sm cursor-pointer disabled:opacity-60 font-['Inter',sans-serif]"
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
              </motion.button>
            </motion.form>

            {/* Bottom Signup Link */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="mt-6 text-center"
            >
              <p className="text-sm text-slate-600 font-['Inter',sans-serif]">
                New to TrackBook?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    navigate('/signup');
                  }}
                  className="font-semibold text-[#4648d4] hover:underline cursor-pointer bg-transparent border-none p-0 inline font-['Inter',sans-serif]"
                >
                  Create an account
                </button>
              </p>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
