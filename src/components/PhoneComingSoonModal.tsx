import React from 'react';
import { motion } from 'motion/react';
import { Construction, Sparkles, X, Chrome } from 'lucide-react';
import { cn } from '../lib/utils';

interface PhoneComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'login' | 'link';
  theme: 'light' | 'dark';
  onContinueWithGmail?: () => void;
}

export const PhoneComingSoonModal: React.FC<PhoneComingSoonModalProps> = ({
  isOpen,
  onClose,
  type,
  theme,
  onContinueWithGmail,
}) => {
  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 select-none">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-md"
      />

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 15 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.25 }}
        className={cn(
          "relative w-full max-w-[420px] rounded-3xl border p-6 sm:p-8 shadow-2xl overflow-hidden",
          isDark
            ? "border-zinc-800 bg-zinc-950 text-slate-100"
            : "border-slate-200 bg-white text-slate-900"
        )}
      >
        {/* Decorative subtle ambient blobs */}
        <div className={cn(
          "absolute -top-12 -left-12 w-28 h-28 rounded-full blur-2xl pointer-events-none",
          isDark ? "bg-indigo-600/20" : "bg-indigo-100/80"
        )} />
        <div className={cn(
          "absolute -bottom-12 -right-12 w-28 h-28 rounded-full blur-2xl pointer-events-none",
          isDark ? "bg-violet-600/20" : "bg-violet-100/80"
        )} />

        {/* Close Button Top Right */}
        <button
          onClick={onClose}
          className={cn(
            "absolute top-4 right-4 p-2 rounded-full transition-all cursor-pointer border",
            isDark
              ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-slate-400 hover:text-slate-200"
              : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          )}
        >
          <X size={15} />
        </button>

        {/* Content Section */}
        <div className="flex flex-col items-center text-center relative z-10">
          
          {/* Icon container */}
          <div className="relative mb-6">
            <div className={cn(
              "absolute inset-0 scale-150 rounded-full animate-pulse duration-1000",
              isDark ? "bg-indigo-500/20" : "bg-indigo-100/70"
            )} />
            <div className={cn(
              "relative flex items-center justify-center w-16 h-16 rounded-2xl shadow-sm border",
              isDark
                ? "border-indigo-500/30 bg-indigo-950/60 text-indigo-400"
                : "border-indigo-200 bg-indigo-50 text-indigo-600"
            )}>
              <Construction size={28} />
              <Sparkles className="absolute -bottom-1 -right-1 text-amber-500 w-4 h-4" />
            </div>
          </div>

          {/* Development Status Badge */}
          <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3.5 border",
            isDark
              ? "bg-emerald-950/50 border-emerald-800/60 text-emerald-400"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          )}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Under Construction
          </span>

          {/* Heading */}
          <h3 className={cn(
            "text-lg sm:text-xl font-bold tracking-tight mb-4",
            isDark ? "text-white" : "text-slate-900"
          )}>
            {type === 'login' ? 'Phone Authentication Coming Soon' : 'Mobile Number Linking Coming Soon'}
          </h3>

          {/* Message Text */}
          <div className={cn(
            "text-xs leading-relaxed font-medium max-w-[340px] mb-6 space-y-3.5",
            isDark ? "text-slate-400" : "text-slate-600"
          )}>
            {type === 'login' ? (
              <>
                <p>
                  Phone number authentication is currently under development and is <span className={cn("font-bold", isDark ? "text-indigo-400" : "text-indigo-600")}>95% complete</span>.
                </p>
                <div className={cn(
                  "p-3 rounded-2xl text-left space-y-1.5 border",
                  isDark ? "bg-zinc-900/70 border-zinc-800" : "bg-slate-50 border-slate-200"
                )}>
                  <p className={cn("font-bold text-[11px] uppercase tracking-wide", isDark ? "text-slate-400" : "text-slate-500")}>For now, please continue using:</p>
                  <p className={cn("font-bold", isDark ? "text-emerald-400" : "text-emerald-600")}>✓ Gmail Login</p>
                  <p className={cn("font-bold", isDark ? "text-emerald-400" : "text-emerald-600")}>✓ Email Login</p>
                </div>
                <p className={cn("text-[11px] italic", isDark ? "text-slate-500" : "text-slate-500")}>
                  We are working on secure OTP verification and will release it soon.
                </p>
              </>
            ) : (
              <>
                <p>
                  Mobile number linking is currently under development and is approximately <span className={cn("font-bold", isDark ? "text-indigo-400" : "text-indigo-600")}>95% complete</span>.
                </p>
                <div className={cn(
                  "p-3 rounded-2xl text-left space-y-1.5 border",
                  isDark ? "bg-zinc-900/70 border-zinc-800" : "bg-slate-50 border-slate-200"
                )}>
                  <p className={cn("font-bold text-[11px] uppercase tracking-wide", isDark ? "text-slate-400" : "text-slate-500")}>Your account remains fully secure using:</p>
                  <p className={cn("font-bold", isDark ? "text-emerald-400" : "text-emerald-600")}>✓ Gmail Authentication</p>
                  <p className={cn("font-bold", isDark ? "text-emerald-400" : "text-emerald-600")}>✓ Email Authentication</p>
                </div>
                <p className={cn("text-[11px] italic", isDark ? "text-slate-500" : "text-slate-500")}>
                  Phone verification will be available in an upcoming update.
                </p>
              </>
            )}
          </div>

          {/* Development Progress Bar Visualizer */}
          <div className="w-full mb-8">
            <div className="flex justify-between text-[11px] font-bold mb-2">
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>Feature Progress</span>
              <span className={cn("font-bold", isDark ? "text-indigo-400" : "text-indigo-600")}>95%</span>
            </div>
            
            <div className={cn(
              "w-full h-2.5 rounded-full relative overflow-hidden",
              isDark ? "bg-zinc-800" : "bg-slate-100"
            )}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "95%" }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
              </motion.div>
            </div>
            
            <p className={cn("text-[10px] font-semibold mt-2", isDark ? "text-slate-500" : "text-slate-500")}>
              Status: <span className="italic">Final OTP provider integration pending.</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-3">
            {type === 'login' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onContinueWithGmail) onContinueWithGmail();
                  }}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-2"
                >
                  <Chrome size={13} className="text-white shrink-0" />
                  Continue with Gmail
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "w-full py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer border",
                    isDark
                      ? "bg-zinc-900 border-zinc-800 text-slate-300 hover:text-white hover:bg-zinc-800"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  Close
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
              >
                Got It
              </button>
            )}
          </div>

        </div>
      </motion.div>
    </div>
  );
};
