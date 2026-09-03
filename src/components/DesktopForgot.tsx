import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

interface DesktopForgotProps {
  email: string;
  setEmail: (val: string) => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  setSuccess: (val: string | null) => void;
  handleAuth: (e: React.FormEvent) => void;
  setMode: (mode: 'signin' | 'signup' | 'forgot') => void;
  navigate: (path: string) => void;
}

export default function DesktopForgot({
  email,
  setEmail,
  loading,
  error,
  success,
  setSuccess,
  handleAuth,
  setMode,
  navigate
}: DesktopForgotProps) {
  const handleResend = () => {
    setSuccess(null);
  };

  return (
    <div className="min-h-screen bg-[#fbf8ff] text-[#1b1a23] antialiased flex flex-col justify-between selection:bg-[#4648d4]/15 selection:text-[#4648d4] font-['Inter',sans-serif] relative overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-[#4648d4]/10 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-[#8455ef]/10 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1.2s' }} />

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full px-6 sm:px-12 py-5 flex items-center justify-between relative z-10"
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

      {/* Centered Form Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md w-full bg-white/90 backdrop-blur-xl rounded-3xl p-8 sm:p-10 border border-slate-200/80 shadow-2xl flex flex-col items-center text-center font-['Inter',sans-serif]"
        >
          <AnimatePresence mode="wait">
            {!success ? (
              <motion.div 
                key="forgot-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="w-full flex flex-col items-center"
              >
                {/* Reset Icon Badge */}
                <motion.div 
                  initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                  className="w-14 h-14 rounded-2xl bg-indigo-50 text-[#4648d4] flex items-center justify-center mb-6 shadow-sm border border-indigo-100"
                >
                  <span className="material-symbols-outlined text-3xl">lock_reset</span>
                </motion.div>

                {/* Headings */}
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight font-['Hanken_Grotesk',sans-serif]">
                  Reset your password
                </h1>
                <p className="mt-2 text-[14px] text-slate-600 leading-relaxed max-w-sm mb-6 font-normal font-['Inter',sans-serif]">
                  No worries. Enter your email and we’ll help you get back into your TrackBook account.
                </p>

                {/* Error Banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, y: -6 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -6 }}
                      className="w-full mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3 text-left font-['Inter',sans-serif] overflow-hidden"
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
                </AnimatePresence>

                {/* Form */}
                <form onSubmit={handleAuth} className="w-full space-y-4 font-['Inter',sans-serif]">
                  <div className="text-left">
                    <label className="block text-[11px] font-semibold tracking-wider text-slate-700 uppercase mb-1.5 font-['Inter',sans-serif]">
                      EMAIL ADDRESS
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
                        <span>Sending link...</span>
                      </>
                    ) : (
                      <span>SEND RESET LINK</span>
                    )}
                  </motion.button>
                </form>

                {/* Back to Sign In link */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      navigate('/login');
                    }}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#4648d4] hover:underline cursor-pointer bg-transparent border-none p-0 font-['Inter',sans-serif]"
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Sign in</span>
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="forgot-success"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.4 }}
                className="w-full flex flex-col items-center"
              >
                {/* Success View */}
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 shadow-sm border border-emerald-100"
                >
                  <span className="material-symbols-outlined text-3xl">mark_email_read</span>
                </motion.div>

                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight font-['Hanken_Grotesk',sans-serif]">
                  Check your inbox
                </h1>
                <p className="mt-3 text-[14px] text-slate-600 leading-relaxed max-w-sm mb-6 font-['Inter',sans-serif]">
                  We’ve sent password reset instructions to <span className="font-semibold text-slate-900">{email}</span>. It may take a few minutes to arrive.
                </p>

                <div className="w-full space-y-3 font-['Inter',sans-serif]">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      setMode('signin');
                      navigate('/login');
                    }}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#4648d4] to-[#6052a8] text-white font-semibold text-xs tracking-wider uppercase shadow-md shadow-[#4648d4]/25 hover:shadow-lg hover:shadow-[#4648d4]/35 transition-all cursor-pointer font-['Inter',sans-serif]"
                  >
                    BACK TO SIGN IN
                  </motion.button>

                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-xs font-medium text-slate-500 hover:text-[#4648d4] transition-colors cursor-pointer bg-transparent border-none p-1 font-['Inter',sans-serif]"
                  >
                    Didn&apos;t receive the email? Click to resend
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
}
