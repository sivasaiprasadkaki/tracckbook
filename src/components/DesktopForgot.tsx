import React from 'react';
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
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-[#4648d4]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-[#8455ef]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="w-full px-6 sm:px-12 py-5 flex items-center justify-between relative z-10">
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-3 cursor-pointer select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-[#4648d4] flex items-center justify-center text-white shadow-md shadow-[#4648d4]/20 hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-2xl">menu_book</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#4648d4] font-['Hanken_Grotesk',sans-serif]">
            TrackBook
          </span>
        </div>
      </header>

      {/* Centered Form Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-xl rounded-3xl p-8 sm:p-10 border border-slate-200/80 shadow-2xl flex flex-col items-center text-center font-['Inter',sans-serif]">
          {!success ? (
            <>
              {/* Reset Icon Badge */}
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-[#4648d4] flex items-center justify-center mb-6 shadow-sm border border-indigo-100">
                <span className="material-symbols-outlined text-3xl">lock_reset</span>
              </div>

              {/* Headings */}
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight font-['Hanken_Grotesk',sans-serif]">
                Reset your password
              </h1>
              <p className="mt-2 text-[14px] text-slate-600 leading-relaxed max-w-sm mb-6 font-normal font-['Inter',sans-serif]">
                No worries. Enter your email and we’ll help you get back into your TrackBook account.
              </p>

              {/* Error Banner */}
              {error && (
                <div className="w-full mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3 text-left animate-fade-in font-['Inter',sans-serif]">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1 whitespace-pre-line">{error}</div>
                </div>
              )}

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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#4648d4] to-[#6052a8] text-white font-semibold text-xs tracking-wider uppercase shadow-md shadow-[#4648d4]/25 hover:shadow-lg hover:shadow-[#4648d4]/35 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed font-['Inter',sans-serif]"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Sending link...</span>
                    </>
                  ) : (
                    <span>SEND RESET LINK</span>
                  )}
                </button>
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
            </>
          ) : (
            <>
              {/* Success View */}
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 shadow-sm border border-emerald-100">
                <span className="material-symbols-outlined text-3xl">mark_email_read</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight font-['Hanken_Grotesk',sans-serif]">
                Check your inbox
              </h1>
              <p className="mt-3 text-[14px] text-slate-600 leading-relaxed max-w-sm mb-6 font-['Inter',sans-serif]">
                We’ve sent password reset instructions to <span className="font-semibold text-slate-900">{email}</span>. It may take a few minutes to arrive.
              </p>

              <div className="w-full space-y-3 font-['Inter',sans-serif]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    navigate('/login');
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#4648d4] to-[#6052a8] text-white font-semibold text-xs tracking-wider uppercase shadow-md shadow-[#4648d4]/25 hover:shadow-lg hover:shadow-[#4648d4]/35 active:scale-[0.99] transition-all cursor-pointer font-['Inter',sans-serif]"
                >
                  BACK TO SIGN IN
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  className="text-xs font-medium text-slate-500 hover:text-[#4648d4] transition-colors cursor-pointer bg-transparent border-none p-1 font-['Inter',sans-serif]"
                >
                  Didn&apos;t receive the email? Click to resend
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
