import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

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
  return (
    <div className="bg-background h-screen w-full overflow-hidden flex font-body-md text-on-surface">
      {/* Left Branding Panel (60%) */}
      <div className="hidden lg:flex w-[60%] h-full relative mesh-gradient-bg items-center justify-center p-margin-desktop overflow-hidden shrink-0">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern height="40" id="grid" patternUnits="userSpaceOnUse" width="40">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#5b3df5" strokeWidth="0.5"></path>
              </pattern>
            </defs>
            <rect fill="url(#grid)" height="100%" width="100%"></rect>
          </svg>
        </div>
        
        {/* Floating Glass UI Elements */}
        <div className="relative w-full max-w-2xl aspect-[4/3] flex items-center justify-center perspective-[1000px]">
          {/* Center piece */}
          <div className="glass-panel-dark rounded-xl p-8 w-80 h-96 absolute z-20 shadow-2xl transform hover:scale-105 transition-transform duration-500 ease-out flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-white text-3xl">auto_awesome</span>
                <h3 className="font-headline-md text-headline-md text-white">AI Assistant</h3>
              </div>
              <div className="space-y-4">
                <div className="h-2 w-3/4 bg-white/20 rounded-full"></div>
                <div className="h-2 w-1/2 bg-white/20 rounded-full"></div>
                <div className="h-2 w-5/6 bg-white/20 rounded-full"></div>
              </div>
            </div>
            <div className="mt-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20">
                <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse"></span>
                <span className="font-label-md text-label-md text-white">System Active</span>
              </div>
            </div>
          </div>
          {/* Background blurred elements */}
          <div className="glass-panel rounded-xl w-64 h-80 absolute -left-12 top-10 z-10 rotate-[-5deg] opacity-70 p-6 flex flex-col gap-4">
            <div className="h-8 w-8 rounded-full bg-primary-container/20"></div>
            <div className="h-3 w-full bg-surface-container-highest rounded-full"></div>
            <div className="h-3 w-2/3 bg-surface-container-highest rounded-full"></div>
          </div>
          <div className="glass-panel rounded-xl w-72 h-64 absolute -right-8 bottom-12 z-30 rotate-[3deg] opacity-90 p-6">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-4 mb-4">
              <div className="font-body-sm text-body-sm text-on-surface-variant">Scanning...</div>
              <span className="material-symbols-outlined text-primary-container">document_scanner</span>
            </div>
            <div className="space-y-3">
              <div className="h-10 w-full bg-surface-container rounded-lg"></div>
              <div className="h-10 w-full bg-surface-container rounded-lg"></div>
            </div>
          </div>
        </div>

        {/* Brand Footer Overlay */}
        <div className="absolute bottom-margin-desktop left-margin-desktop flex items-center gap-3 z-40 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shadow-lg">
            <span className="font-headline-lg text-headline-lg text-white font-bold leading-none tracking-tighter">T</span>
          </div>
          <div className="font-headline-md text-headline-md text-on-primary-fixed font-bold">TrackBook AI</div>
        </div>
      </div>

      {/* Right Auth Panel (40%) */}
      <div className="w-full lg:w-[40%] h-full bg-surface-container-lowest flex flex-col justify-center items-center p-margin-mobile lg:p-margin-desktop relative z-10 shadow-[-20px_0_40px_rgba(0,0,0,0.02)] overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-md bg-primary-container flex items-center justify-center">
              <span className="font-headline-lg-mobile text-headline-lg-mobile text-white font-bold leading-none tracking-tighter">T</span>
            </div>
            <div className="font-headline-md text-headline-md text-on-surface font-bold">TrackBook AI</div>
          </div>

          <div className="text-center lg:text-left space-y-2">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Reset Password</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Enter your email address and we'll send you instructions to reset your password.</p>
          </div>

          <div className="glass-panel-opaque-shadow rounded-xl p-6 lg:p-8 space-y-6">
            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl flex items-start gap-2 text-xs font-semibold">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                <span className="flex-1 leading-relaxed">{error}</span>
              </div>
            )}

            {success ? (
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-4" id="confirmationState">
                <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-primary-container text-4xl">mark_email_read</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Check your email</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">We've sent a password reset link to <span className="font-medium text-on-surface" id="displayEmail">{email}</span>.</p>
                <button 
                  className="mt-4 text-primary-container font-label-md text-label-md uppercase tracking-wider link-hover flex items-center gap-1 bg-transparent border-none cursor-pointer outline-none font-bold" 
                  onClick={() => setSuccess(null)} 
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  Resend Link
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuth} className="space-y-5" id="resetForm">
                <div className="space-y-1.5">
                  <label className="block font-label-md text-label-md text-on-surface-variant" htmlFor="email">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-outline text-[20px]">mail</span>
                    </div>
                    <input 
                      className="input-field block w-full pl-10 pr-3 py-2.5 border border-outline-variant rounded-lg bg-white text-on-surface font-body-md text-body-md placeholder-outline-variant focus:ring-0" 
                      id="email" 
                      name="email" 
                      placeholder="name@company.com" 
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <button 
                  className="btn-primary w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg font-label-md text-label-md uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container cursor-pointer" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? <Loader2 size={18} className="animate-spin inline-block" /> : "Send Reset Link"}
                </button>
              </form>
            )}
          </div>

          <div className="text-center">
            <button 
              onClick={() => setMode('signin')} 
              className="inline-flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant link-hover bg-transparent border-none cursor-pointer outline-none font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Login
            </button>
          </div>
        </div>

        <div className="absolute bottom-6 w-full text-center lg:text-left lg:px-margin-desktop pointer-events-none">
          <p className="font-label-md text-label-md text-outline-variant">© 2024 TrackBook AI. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
