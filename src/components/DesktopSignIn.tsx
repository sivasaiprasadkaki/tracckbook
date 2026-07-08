import React from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  return (
    <div className="flex h-screen w-full bg-background text-on-background font-body-md overflow-hidden selection:bg-primary-container selection:text-on-primary-container">
      {/* Left Side: Branding Panel (60%) */}
      <div className="hidden lg:flex w-[60%] bg-[#F7F8FC] flex-col justify-between p-margin-desktop relative overflow-hidden shrink-0">
        {/* Ambient Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary-container/10 blur-[120px]"></div>
        
        <div className="z-10 fade-in-up" style={{ animationDelay: '0.1s' }}>
          <img 
            alt="TrackBook AI Logo" 
            className="h-10 mb-8 cursor-pointer" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAg50DxnvJBIIV-VZUq1WR6ehWpbnIgEsszjWuRX4MBvkIA_q1LshJLCJCNZEQ0pxIfpCa8SYNDfB8dgaMUfl5rsj3urQTWrSnriqUQcvQ153exlXMFDhRiUIDAw22k7my9sEGGJNU-4AIq9fB06H9rvt6X1m6cQrjTFy2frJmXZ7pvcTCw9b3F_rFqVz6zDYrN73srq01JI4kVd3QtbpYbcQLno79tUJkD5bh_wdmmcBsDV13-w_ZZOzRCLeuuBURmsw_5A5ayOltx" 
            onClick={() => navigate('/')} 
          />
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container border border-surface-variant mb-6">
            <span className="material-symbols-outlined text-[16px] text-primary">auto_awesome</span>
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Introducing TrackBook AI</span>
          </div>
          <h1 className="font-display-lg text-display-lg text-on-surface mb-6 leading-tight max-w-2xl">
            Track Smarter.<br />
            Import Faster.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary-container">Let TrackBook AI Do The Work.</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
            Experience seamless financial tracking powered by visionary AI. Connect your accounts, automate categorization, and gain real-time insights with zero cognitive load.
          </p>
        </div>

        {/* Visual Centerpiece */}
        <div className="relative flex-1 flex items-center justify-center mt-12 z-10 fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="relative w-full max-w-3xl aspect-[16/9]">
            <img 
              alt="TrackBook AI Dashboard Visualization" 
              className="absolute inset-0 w-full h-full object-contain float-anim" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0yoahekQxJ4WJhdwDwBiENJzES4pNaEIiw5CmqBxln5_bVUGIPA7ts74VB38UueRvH-QAlZ1tVDK-yAWB0TbccmR7G4a3UBD9skGizoG5Th2Namro1h6y_ciVKaNFN3_ec8lGhGDbXgh70dwXfGpymWW7njvMni9DBfJQPN1Yu_8vukWaWxl4NP1yi6rwWbRPkqYPO20xJwzHQ5h0jPtDcAi8j7vHYC1VINj-ZqGD1OeCJhn_TK4lLNQDJb2metGTp34MAnfwnNof" 
            />
            {/* Floating Widgets */}
            <div className="absolute top-[15%] left-[5%] glass-panel-opaque rounded-xl p-4 flex items-center gap-4 float-anim-delayed">
              <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">receipt_long</span>
              </div>
              <div>
                <p className="font-label-md text-label-md text-outline">LATEST SCAN</p>
                <p className="font-body-md text-body-md font-medium text-on-surface">Uber Ride - ₹24.50</p>
              </div>
            </div>
            <div className="absolute bottom-[20%] right-[5%] glass-panel-opaque rounded-xl p-4 flex items-center gap-4 float-anim">
              <div className="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary">analytics</span>
              </div>
              <div>
                <p className="font-label-md text-label-md text-outline">AI INSIGHT</p>
                <p className="font-body-md text-body-md font-medium text-on-surface">Travel budget optimal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Auth Card (40%) */}
      <div className="w-full lg:w-[40%] bg-[#F7F8FC] flex items-center justify-center p-margin-mobile lg:p-margin-desktop z-20 shadow-[-20px_0_40px_rgba(0,0,0,0.02)] overflow-y-auto">
        <div className="w-full max-w-md bg-white rounded-[24px] p-8 lg:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] border border-surface-variant fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="text-center mb-8">
            <img 
              alt="TrackBook AI Logo Mobile" 
              className="h-8 mx-auto mb-6 lg:hidden" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAg50DxnvJBIIV-VZUq1WR6ehWpbnIgEsszjWuRX4MBvkIA_q1LshJLCJCNZEQ0pxIfpCa8SYNDfB8dgaMUfl5rsj3urQTWrSnriqUQcvQ153exlXMFDhRiUIDAw22k7my9sEGGJNU-4AIq9fB06H9rvt6X1m6cQrjTFy2frJmXZ7pvcTCw9b3F_rFqVz6zDYrN73srq01JI4kVd3QtbpYbcQLno79tUJkD5bh_wdmmcBsDV13-w_ZZOzRCLeuuBURmsw_5A5ayOltx" 
            />
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">Welcome back</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Sign in to continue to your dashboard.</p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl flex items-start gap-2 text-xs font-semibold mb-4">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-4 py-3 rounded-xl flex items-start gap-2 text-xs font-semibold mb-4">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-500" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-2" htmlFor="email">EMAIL ADDRESS</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline-variant text-[20px]">mail</span>
                </div>
                <input 
                  className="block w-full pl-10 pr-3 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface placeholder-outline focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all text-sm" 
                  id="email" 
                  placeholder="you@company.com" 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-label-md text-label-md text-on-surface-variant" htmlFor="password">PASSWORD</label>
                <button 
                  type="button" 
                  onClick={() => setMode('forgot')} 
                  className="font-label-md text-label-md text-primary hover:text-primary-container transition-colors bg-transparent border-none cursor-pointer outline-none"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline-variant text-[20px]">lock</span>
                </div>
                <input 
                  className="block w-full pl-10 pr-12 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface placeholder-outline focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all text-sm" 
                  id="password" 
                  placeholder="••••••••" 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors p-1 bg-transparent border-none outline-none cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? "visibility" : "visibility_off"}</span>
                </button>
              </div>
            </div>

            <button 
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm font-body-md text-body-md font-medium text-white bg-primary hover:bg-primary-container hover:shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary mt-6 cursor-pointer" 
              type="submit"
              disabled={loading}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Sign In"}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surface-variant"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-on-surface-variant font-label-md text-label-md">OR</span>
              </div>
            </div>

            <button 
              className="w-full flex items-center justify-center py-3 px-4 border border-outline-variant rounded-lg shadow-sm font-body-md text-body-md font-medium text-on-surface bg-white hover:bg-surface-container-low transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary cursor-pointer" 
              type="button"
              onClick={handleGoogleLogin}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.5 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              Login with Google
            </button>
          </form>
          
          <p className="mt-8 text-center font-body-sm text-body-sm text-on-surface-variant">
            Don't have an account? <button onClick={() => setMode('signup')} className="font-medium text-primary hover:text-primary-container transition-colors bg-transparent border-none cursor-pointer outline-none">Create one</button>
          </p>
        </div>
      </div>
    </div>
  );
}
