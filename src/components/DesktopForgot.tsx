import React from 'react';
import { Loader2 } from 'lucide-react';

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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAuth(e);
  };

  const handleResend = () => {
    setSuccess(null);
  };

  return (
    <div className="bg-background h-screen w-full overflow-hidden flex font-body-md text-on-surface">
      <style>{`
        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(1deg); }
        }
        @keyframes shimmer {
            0% { transform: translateX(-100%) skewX(-15deg); }
            100% { transform: translateX(200%) skewX(-15deg); }
        }
        @keyframes grid-breathe {
            0%, 100% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(1.05); }
        }
        @keyframes fade-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-grid-breathe { animation: grid-breathe 10s ease-in-out infinite; }
        .animate-fade-up { animation: fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fade-in 1s ease-out forwards; }

        .glass-panel {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(32px);
            -webkit-backdrop-filter: blur(32px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
            position: relative;
            overflow: hidden;
        }
        .glass-panel::after {
            content: "";
            position: absolute;
            top: 0;
            left: -50%;
            width: 200%;
            height: 100%;
            background: linear-gradient(
                to right,
                transparent,
                rgba(255, 255, 255, 0.3),
                transparent
            );
            transform: skewX(-15deg);
            animation: shimmer 4s infinite linear;
            pointer-events: none;
        }
        
        .mesh-gradient-bg {
            background-image: radial-gradient(at 40% 20%, hsla(250, 89%, 60%, 1) 0px, transparent 50%),
                              radial-gradient(at 80% 0%, hsla(190, 100%, 49%, 1) 0px, transparent 50%),
                              radial-gradient(at 0% 50%, hsla(250, 100%, 85%, 1) 0px, transparent 50%);
            background-color: #f8f9fd;
        }
        
        .input-field { transition: all 0.3s ease; }
        .input-field:focus {
            border-color: #5b3df5;
            box-shadow: 0 0 0 4px rgba(91, 61, 245, 0.1);
            outline: none;
        }

        .btn-primary {
            background: #5b3df5;
            color: white;
            transition: all 0.3s ease;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #5b3df5 0%, #7621ff 100%);
            box-shadow: 0 4px 15px rgba(91, 61, 245, 0.3);
            transform: translateY(-1px);
        }

        .link-hover { transition: color 0.2s ease; }
        .link-hover:hover { color: #5b3df5; }
      `}</style>

      {/* Left Branding Panel (60%) */}
      <div className="hidden lg:flex w-[60%] h-full relative mesh-gradient-bg items-center justify-center p-[40px] overflow-hidden">
        {/* Abstract Decorative Elements */}
        <div className="absolute inset-0 pointer-events-none animate-grid-breathe">
          <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern height="40" id="grid" patternUnits="userSpaceOnUse" width="40">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#5b3df5" strokeWidth="0.5"></path>
              </pattern>
            </defs>
            <rect fill="url(#grid)" height="100%" width="100%"></rect>
          </svg>
        </div>

        {/* Floating Glass UI Elements Container */}
        <div className="relative w-full max-w-2xl aspect-[4/3] flex items-center justify-center perspective-[1000px] animate-float">
          <img 
            alt="Smart Reporting Illustration" 
            className="w-full h-full object-contain rounded-xl shadow-2xl" 
            src="https://lh3.googleusercontent.com/aida/AP1WRLsDPklXilWjl0u4e_qYh_1PHlCN7ai_9mddL4dXu6iI5ymDQ6q4GaH1ujp7FOLlurRfVP7fJQEBTk62m5fcsYhNDmeTeQ4MpTyDmKYIEHYAj2uoPBa1Y68PQevwxjAPdKfPXC6r_dXFyXV_NXLtIw3FqDzIm9CYlcySNOetuYe7oAdHbJP8Ee7EL5ZCDVsOuaw9KwnB-6KVVefSEyXEqt4gekCLcZS3gZWJ1w8VMhcTVfUAOf9v8MrR8Z8v"
          />
        </div>

        {/* Brand Footer Overlay */}
        <div 
          className="absolute bottom-[40px] left-[40px] flex items-center gap-3 z-40 animate-fade-in cursor-pointer select-none" 
          style={{ animationDelay: '0.5s' }}
          onClick={() => navigate('/')}
        >
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shadow-lg">
            <span className="font-headline-lg text-headline-lg text-white font-bold leading-none tracking-tighter">T</span>
          </div>
          <div className="font-headline-md text-headline-md text-on-primary-fixed font-bold">AI TrackBook</div>
        </div>
      </div>

      {/* Right Auth Panel (40%) */}
      <div className="w-full lg:w-[40%] h-full bg-surface-container-lowest flex flex-col justify-center items-center p-[16px] lg:p-[40px] relative z-10 shadow-[-20px_0_40px_rgba(0,0,0,0.02)] animate-fade-in">
        <div className="w-full max-w-md space-y-8">
          
          {/* Mobile Brand Logo */}
          <div 
            className="flex lg:hidden items-center justify-center gap-2 mb-8 cursor-pointer select-none"
            onClick={() => navigate('/')}
          >
            <div className="w-8 h-8 rounded-md bg-primary-container flex items-center justify-center">
              <span className="font-headline-lg-mobile text-headline-lg-mobile text-white font-bold leading-none tracking-tighter">T</span>
            </div>
            <div className="font-headline-md text-headline-md text-on-surface font-bold">AI TrackBook</div>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left space-y-2 opacity-0 animate-fade-up" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Reset Password</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Enter your email address and we'll send you instructions to reset your password.</p>
          </div>

          {/* Error alerts */}
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-none flex items-start gap-2 text-xs font-semibold">
              <span className="material-symbols-outlined text-rose-500 text-[18px]">error</span>
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form Area */}
          <div className="glass-panel rounded-none p-6 lg:p-8 space-y-6 opacity-0 animate-fade-up" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
            {!success ? (
              /* Standard State Form */
              <form onSubmit={handleFormSubmit} className="space-y-5" id="resetForm">
                <div className="space-y-1.5">
                  <label className="block font-label-md text-label-md text-on-surface-variant" htmlFor="email">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-outline text-[20px]">mail</span>
                    </div>
                    <input 
                      className="input-field block w-full pl-10 pr-3 py-2.5 border border-outline-variant rounded-none bg-white text-on-surface font-body-md text-body-md placeholder-outline-variant focus:ring-0" 
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
                  className="btn-primary w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-none font-label-md text-label-md uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container cursor-pointer font-bold" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Send Reset Link'}
                </button>
              </form>
            ) : (
              /* Success Confirmation State */
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-4" id="confirmationState">
                <div className="w-16 h-16 rounded-none bg-surface-container flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-primary-container text-4xl">mark_email_read</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Check your email</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  We've sent a password reset link to <span className="font-medium text-on-surface break-all">{email}</span>.
                </p>
                <button 
                  className="mt-4 text-primary-container font-label-md text-label-md uppercase tracking-wider link-hover flex items-center gap-1 bg-transparent border-none cursor-pointer outline-none font-bold" 
                  onClick={handleResend}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  Resend Link
                </button>
              </div>
            )}
          </div>

          {/* Back to Login Link */}
          <div className="text-center opacity-0 animate-fade-up" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
            <button 
              onClick={() => setMode('signin')}
              className="inline-flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant link-hover bg-transparent border-none cursor-pointer outline-none font-medium"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Login
            </button>
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="absolute bottom-6 w-full text-center lg:text-left lg:px-[40px] opacity-0 animate-fade-in" style={{ animationDelay: '1s', animationFillMode: 'forwards' }}>
          <p className="font-label-md text-label-md text-outline-variant">© 2024 AI TrackBook. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

