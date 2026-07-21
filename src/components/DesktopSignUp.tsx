import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

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
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  const reqs = [
    { label: '6+ characters', met: password.length >= 6 },
    { label: 'Capital letter', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      alert('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
    handleAuth(e);
  };

  return (
    <div className="bg-background text-on-surface antialiased overflow-hidden h-screen flex w-full font-body-md">
      <style>{`
        .glass-panel {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-top: 1px solid rgba(255, 255, 255, 0.4);
            border-left: 1px solid rgba(255, 255, 255, 0.4);
        }
        
        .bg-mesh-gradient {
            background-color: #4212de;
            background-image: 
                radial-gradient(at 0% 0%, hsla(271,100%,50%,1) 0px, transparent 50%),
                radial-gradient(at 100% 0%, hsla(190,100%,49%,1) 0px, transparent 50%),
                radial-gradient(at 100% 100%, hsla(271,100%,50%,1) 0px, transparent 50%),
                radial-gradient(at 0% 100%, hsla(190,100%,49%,1) 0px, transparent 50%);
        }

        .input-glow:focus-within {
            box-shadow: 0 0 0 3px rgba(91, 61, 245, 0.15);
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(1deg); }
        }
      `}</style>

      {/* Left Branding Column (60%) */}
      <div className="hidden lg:flex w-[60%] h-full bg-mesh-gradient relative items-center justify-center p-12 overflow-hidden">
        {/* Abstract Background Image */}
        <div 
          className="absolute inset-0 opacity-20 mix-blend-overlay" 
          style={{ 
            backgroundImage: `url('https://lh3.googleusercontent.com/aida/AP1WRLut4PdOPYI5r8I9WCqL7odoZvw5urODdF0nVH6Hyzjgu9S00FvlxBt6QLzPsOEiSpYyJbWJgjv75cA9qy3BBBK1dT2z6_qvaZd4ODhN7Xp8dny-wJIhIVRdY-pUznqmr5-4qwusEqmX74i1KkHTDXhYdEHFM43zpfhSi4m_t1I-L4Uzh49LOTP02CXJFU1OIuAjBZh-OAQ1JteoNZGEhKgTy1L9fqVTBtBkdTDQStDs4MgGQxGrKYjTjbww')`, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center', 
            animation: 'float 6s ease-in-out infinite' 
          }}
        ></div>
        
        {/* Content Container */}
        <div className="relative z-10 flex flex-col items-start max-w-xl text-white">
          <div 
            className="flex items-center gap-3 mb-8 cursor-pointer select-none"
            onClick={() => navigate('/')}
          >
            <span className="material-symbols-outlined text-4xl text-secondary-fixed">auto_graph</span>
            <h1 className="font-display-lg text-display-lg tracking-tight font-bold">AI TrackBook</h1>
          </div>
          <h2 className="font-headline-lg text-headline-lg mb-6 leading-tight text-on-primary-container">
            Automation Mail.<br />
            Integrated.
          </h2>
          <p className="font-body-lg text-body-lg text-primary-fixed-dim mb-12 opacity-90">
            Directly send and manage your communications through native Gmail and Outlook integrations. Sync your workflow and reach your audience without ever leaving the AI TrackBook dashboard.
          </p>

          <div className="flex items-center gap-3 bg-primary-container/20 border border-primary-container/30 rounded-full px-4 py-2 w-fit transition-all hover:bg-primary-container/30">
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                <img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" className="w-4 h-4" alt="Gmail" />
              </div>
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                <img src="https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg" className="w-4 h-4" alt="Outlook" />
              </div>
            </div>
            <span className="font-label-md text-label-md text-white font-medium">Gmail &amp; Outlook Sync</span>
            <span className="material-symbols-outlined text-secondary-fixed text-body-sm">verified</span>
          </div>
        </div>
      </div>

      {/* Right Auth Column (40%) */}
      <div className="w-full lg:w-[40%] h-full flex items-center justify-center bg-surface p-6 lg:p-8 relative overflow-y-auto">
        {/* Subtle Background Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#191c1f 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        ></div>

        <div className="w-full max-w-md flex flex-col relative z-10 my-auto">
          {/* Mobile Header (Visible only on small screens) */}
          <div 
            className="flex lg:hidden items-center gap-2 mb-4 justify-center cursor-pointer select-none"
            onClick={() => navigate('/')}
          >
            <span className="material-symbols-outlined text-3xl text-primary">auto_graph</span>
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">AI TrackBook</h1>
          </div>

          <div className="mb-3">
            <h2 className="font-headline-lg-mobile lg:font-headline-lg text-2xl lg:text-3xl text-on-surface mb-1 font-semibold">Create Account</h2>
            <p className="text-xs text-on-surface-variant">Start tracking with AI precision.</p>
          </div>

          {/* Error and Success alerts */}
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 px-3 py-2 rounded-lg flex items-start gap-2 text-xs font-semibold mb-2">
              <span className="material-symbols-outlined text-rose-500 text-[16px]">error</span>
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-3 py-2 rounded-lg flex items-start gap-2 text-xs font-semibold mb-2">
              <span className="material-symbols-outlined text-emerald-500 text-[16px]">check_circle</span>
              <span className="flex-1 leading-relaxed whitespace-pre-line">{success}</span>
            </div>
          )}

          {/* Form */}
          <form className="flex flex-col gap-3" onSubmit={handleFormSubmit}>
            {/* Google Button */}
            <button 
              className="w-full flex items-center justify-center gap-2.5 py-2 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container transition-colors text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer font-medium" 
              type="button"
              onClick={handleGoogleLogin}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              Sign up with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-0.5">
              <div className="h-px bg-outline-variant flex-1"></div>
              <span className="text-[11px] text-outline font-semibold uppercase tracking-wider">OR EMAIL</span>
              <div className="h-px bg-outline-variant flex-1"></div>
            </div>

            {/* Inputs */}
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-1 input-glow transition-all rounded-lg">
                <label className="text-xs text-on-surface-variant font-medium ml-0.5" htmlFor="fullName">Full Name</label>
                <input 
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-0 outline-none transition-colors placeholder:text-outline/60 shadow-sm" 
                  id="fullName" 
                  placeholder="Jane Doe" 
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1 input-glow transition-all rounded-lg">
                <label className="text-xs text-on-surface-variant font-medium ml-0.5" htmlFor="email">Work Email</label>
                <input 
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-0 outline-none transition-colors placeholder:text-outline/60 shadow-sm" 
                  id="email" 
                  placeholder="jane@company.com" 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1 input-glow transition-all rounded-lg">
                <label className="text-xs text-on-surface-variant font-medium ml-0.5" htmlFor="password">Password</label>
                <div className="relative">
                  <input 
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-0 outline-none transition-colors placeholder:text-outline/60 shadow-sm pr-9" 
                    id="password" 
                    placeholder="••••••••" 
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors cursor-pointer" 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1 input-glow transition-all rounded-lg">
                <label className="text-xs text-on-surface-variant font-medium ml-0.5" htmlFor="confirmPassword">Confirm Password</label>
                <div className="relative">
                  <input 
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:border-primary focus:ring-0 outline-none transition-colors placeholder:text-outline/60 shadow-sm pr-9" 
                    id="confirmPassword" 
                    placeholder="••••••••" 
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors cursor-pointer" 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              <div className="p-2.5 bg-surface-container-low/80 rounded-lg border border-outline-variant/50 space-y-1.5 mt-0.5">
                <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">Password Requirements</p>
                <div className="grid grid-cols-2 gap-1">
                  {reqs.map((req, i) => (
                    <div key={i} className={`flex items-center gap-1 transition-colors ${req.met ? 'text-emerald-600 font-medium' : 'text-outline'}`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {req.met ? 'check_circle' : 'cancel'}
                      </span>
                      <span className="text-[11px]">{req.label}</span>
                    </div>
                  ))}
                </div>
                {confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-1 pt-1 border-t border-outline-variant/40 transition-colors ${password === confirmPassword ? 'text-emerald-600 font-medium' : 'text-rose-500 font-medium'}`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {password === confirmPassword ? 'check_circle' : 'cancel'}
                    </span>
                    <span className="text-[11px]">{password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Checkbox */}
            <div className="flex items-start gap-2.5 mt-0.5 select-none">
              <div className="flex items-center h-4 mt-0.5">
                <input 
                  className="w-3.5 h-3.5 rounded border-outline-variant text-primary focus:ring-primary focus:ring-offset-surface bg-surface-container-lowest cursor-pointer transition-colors" 
                  id="terms" 
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
              </div>
              <label className="text-xs text-on-surface-variant leading-tight cursor-pointer" htmlFor="terms">
                I agree to the <a className="text-primary hover:underline font-medium" href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a> and <a className="text-primary hover:underline font-medium" href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
              </label>
            </div>

            {/* Submit */}
            <button 
              className="w-full bg-primary hover:bg-surface-tint text-white text-xs py-2.5 px-4 rounded-lg transition-all duration-300 shadow-[0_4px_14px_rgba(91,61,245,0.2)] hover:shadow-[0_6px_20px_rgba(91,61,245,0.3)] mt-1 cursor-pointer flex justify-center items-center font-bold uppercase tracking-wider" 
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer Link */}
          <p className="text-xs text-center text-on-surface-variant mt-3">
            Already have an account?{' '}
            <button 
              onClick={() => setMode('signin')} 
              className="text-primary font-medium hover:underline transition-all bg-transparent border-none cursor-pointer outline-none ml-1"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

