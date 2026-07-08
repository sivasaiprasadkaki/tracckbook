import React from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  return (
    <div className="flex h-screen w-full bg-background text-on-surface font-body-md overflow-hidden antialiased">
      {/* Left Branding Column (60%) */}
      <div className="hidden lg:flex w-[60%] h-full bg-mesh-gradient relative items-center justify-center p-12 overflow-hidden shrink-0">
        {/* Abstract Background Image */}
        <div 
          className="absolute inset-0 opacity-20 mix-blend-overlay" 
          style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAj_1r50sHC4mCCU8WOVE1QrJJseCxCE1F-oMwXpokReusKSu9G_nHqlxn_WhdqKK-Q-AOHnevSbl7p24IygkfwdcymMIPmFxkkLuxZPSjvuPO_u3hHbKR5ZbpXLfMWJy_7f6_SspDFcUPDNV07lWTy6qXq4YGoQ_YgpwvyJHsVSP1SW8I6yXgKaAVDxeSYbLnjNXm8EfmgRXhJLrWPEI1q6Ow801MAAkByDeO3Rr-QIx4D3UBIjr16yXpFKb8CstI6_biGRwimL_Dk')" }}
        ></div>
        {/* Content Container */}
        <div className="relative z-10 flex flex-col items-start max-w-xl text-white">
          <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => navigate('/')}>
            <span className="material-symbols-outlined text-4xl text-secondary-fixed">auto_graph</span>
            <h1 className="font-display-lg text-display-lg tracking-tight">TrackBook AI</h1>
          </div>
          <h2 className="font-headline-lg text-headline-lg mb-6 leading-tight text-on-primary-container">
            Visionary Finance.<br />AI-Driven.
          </h2>
          <p className="font-body-lg text-body-lg text-primary-fixed-dim mb-12 opacity-90">
            Experience the future of accounting. Automate your cashflow, categorize expenses instantly, and unlock intelligent insights without the cognitive load.
          </p>
          {/* Decorative Glassmorphic Element */}
          <div className="glass-panel rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-transform duration-700 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary-fixed text-sm">magic_button</span>
                <span className="font-mono-data text-mono-data text-white/80">AI Insight Generated</span>
              </div>
              <span className="font-mono-data text-mono-data text-secondary-fixed">+12.4% Optimization</span>
            </div>
            <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-secondary-fixed w-[78%] rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Auth Column (40%) */}
      <div className="w-full lg:w-[40%] h-full flex items-center justify-center bg-surface p-8 relative overflow-y-auto">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(#191c1f 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>
        <div className="w-full max-w-md flex flex-col relative z-10">
          <div className="flex lg:hidden items-center gap-2 mb-10 justify-center">
            <span className="material-symbols-outlined text-3xl text-primary">auto_graph</span>
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">TrackBook AI</h1>
          </div>
          <div className="mb-8">
            <h2 className="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-on-surface mb-2">Create Account</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Start tracking with AI precision.</p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-lg flex items-start gap-2 text-xs font-semibold mb-4">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-4 py-3 rounded-lg flex items-start gap-2 text-xs font-semibold mb-4">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-500" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="flex flex-col gap-5">
            <button 
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container transition-colors font-label-md text-label-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer" 
              type="button"
              onClick={handleGoogleLogin}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.5 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              Sign up with Google
            </button>

            <div className="flex items-center gap-4 my-2">
              <div className="h-px bg-outline-variant flex-1"></div>
              <span className="font-label-md text-label-md text-outline">OR EMAIL</span>
              <div className="h-px bg-outline-variant flex-1"></div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 input-glow transition-all rounded-lg">
                <label className="font-label-md text-label-md text-on-surface-variant ml-1" htmlFor="fullName">Full Name</label>
                <input 
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-0 outline-none transition-colors placeholder:text-outline/60 shadow-sm text-sm" 
                  id="fullName" 
                  placeholder="Jane Doe" 
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5 input-glow transition-all rounded-lg">
                <label className="font-label-md text-label-md text-on-surface-variant ml-1" htmlFor="email">Work Email</label>
                <input 
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-0 outline-none transition-colors placeholder:text-outline/60 shadow-sm text-sm" 
                  id="email" 
                  placeholder="jane@company.com" 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5 input-glow transition-all rounded-lg">
                <label className="font-label-md text-label-md text-on-surface-variant ml-1" htmlFor="password">Password</label>
                <div className="relative">
                  <input 
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-0 outline-none transition-colors placeholder:text-outline/60 shadow-sm text-sm" 
                    id="password" 
                    placeholder="••••••••" 
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors p-1 bg-transparent border-none outline-none cursor-pointer" 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">{showPassword ? "visibility" : "visibility_off"}</span>
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 input-glow transition-all rounded-lg">
                <label className="font-label-md text-label-md text-on-surface-variant ml-1" htmlFor="confirmPassword">Confirm Password</label>
                <div className="relative">
                  <input 
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-0 outline-none transition-colors placeholder:text-outline/60 shadow-sm text-sm" 
                    id="confirmPassword" 
                    placeholder="••••••••" 
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors p-1 bg-transparent border-none outline-none cursor-pointer" 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">{showConfirmPassword ? "visibility" : "visibility_off"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 mt-2">
              <div className="flex items-center h-5">
                <input 
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary focus:ring-offset-surface bg-surface-container-lowest cursor-pointer transition-colors" 
                  id="terms" 
                  type="checkbox"
                  required
                />
              </div>
              <label className="font-body-sm text-body-sm text-on-surface-variant leading-tight cursor-pointer select-none" htmlFor="terms">
                I agree to the <a className="text-primary hover:underline font-medium" href="#">Terms of Service</a> and <a className="text-primary hover:underline font-medium" href="#">Privacy Policy</a>.
              </label>
            </div>

            <button 
              className="w-full bg-primary hover:bg-surface-tint text-white font-label-md text-label-md py-3.5 px-4 rounded-lg transition-all duration-300 shadow-[0_4px_14px_rgba(91,61,245,0.2)] hover:shadow-[0_6px_20px_rgba(91,61,245,0.3)] mt-2 cursor-pointer" 
              type="submit"
              disabled={loading}
            >
              {loading ? <Loader2 size={18} className="animate-spin inline-block animate-duration-1000" /> : "Create Account"}
            </button>
          </form>

          <p className="font-body-sm text-body-sm text-center text-on-surface-variant mt-8">
            Already have an account? <button onClick={() => setMode('signin')} className="text-primary font-medium hover:underline transition-all bg-transparent border-none cursor-pointer outline-none">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}
