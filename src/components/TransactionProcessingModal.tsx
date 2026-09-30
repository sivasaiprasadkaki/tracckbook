import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, AlertCircle, RefreshCw, X, Sparkles, CloudUpload, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  percent: number;
}

export interface TransactionProcessingModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  progress: number;
  currentStepMessage: string;
  steps: ProcessingStep[];
  status: 'processing' | 'success' | 'error';
  errorMessage?: string | null;
  onRetry: () => void;
  onCancel: () => void;
}

export const TransactionProcessingModal: React.FC<TransactionProcessingModalProps> = ({
  isOpen,
  mode,
  progress,
  currentStepMessage,
  steps,
  status,
  errorMessage,
  onRetry,
  onCancel
}) => {
  if (!isOpen) return null;

  const title = status === 'success' 
    ? (mode === 'create' ? '✓ Entry saved successfully' : '✓ Entry updated successfully')
    : status === 'error'
    ? "Couldn't save your entry"
    : (mode === 'create' ? 'Saving your entry...' : 'Updating your entry...');

  const subtitle = status === 'success'
    ? 'All transactions and cloud records are safely synchronized.'
    : status === 'error'
    ? (errorMessage || 'We encountered an issue while communicating with TrackBook Cloud.')
    : (mode === 'create' 
        ? 'Your receipt is being securely uploaded to TrackBook Cloud.' 
        : 'Saving your latest changes securely.');

  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[500] w-full h-[100dvh] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl select-none"
        style={{ left: 0, top: 0, right: 0, bottom: 0 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          className="relative w-full max-w-sm sm:max-w-md mx-auto rounded-[32px] p-6 sm:p-8 bg-zinc-950/95 border border-zinc-800/90 shadow-2xl shadow-black/90 text-white flex flex-col items-center text-center overflow-hidden backdrop-blur-2xl"
        >
          {/* Subtle Ambient Background Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Center Animated Icon with Circular Progress Loader */}
          <div className="relative w-32 h-32 my-2 flex items-center justify-center">
            {/* SVG Circular Loader */}
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                className="text-zinc-800/70"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={263.89}
                animate={{
                  strokeDashoffset: 263.89 - (263.89 * clampedProgress) / 100
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={cn(
                  status === 'error'
                    ? "text-rose-500"
                    : clampedProgress >= 100 || status === 'success'
                    ? "text-emerald-400"
                    : "text-indigo-500"
                )}
              />
            </svg>

            {/* Inner Content: Center animated icon or big percentage */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {status === 'success' ? (
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 18, stiffness: 220 }}
                  className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10"
                >
                  <Check size={28} className="stroke-[3]" />
                </motion.div>
              ) : status === 'error' ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center"
                >
                  <AlertCircle size={28} />
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <span className="text-3xl font-black tracking-tight text-white font-mono leading-none">
                    {clampedProgress}%
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mt-1 flex items-center gap-1">
                    <CloudUpload size={10} className="animate-pulse" />
                    <span>Sync</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="space-y-1.5 mt-2 mb-4 w-full">
            <h3 className={cn(
              "text-lg sm:text-xl font-black tracking-tight transition-colors duration-300",
              status === 'error' 
                ? "text-rose-400" 
                : status === 'success' 
                ? "text-emerald-400" 
                : "text-white"
            )}>
              {title}
            </h3>
            <p className="text-xs text-zinc-400 px-3 font-medium leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Current Status Message Capsule */}
          {status === 'processing' && (
            <div className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-xl py-2 px-3 mb-4 flex items-center justify-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              <span className="text-xs font-semibold text-indigo-300 truncate">
                {currentStepMessage || 'Processing transaction...'}
              </span>
            </div>
          )}

          {/* Horizontal Progress Bar */}
          <div className="w-full space-y-1.5 mb-5">
            <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800/80 relative">
              <motion.div
                className={cn(
                  "h-full rounded-full transition-all duration-300 relative",
                  status === 'error'
                    ? "bg-rose-500"
                    : clampedProgress >= 100 || status === 'success'
                    ? "bg-emerald-500"
                    : "bg-gradient-to-r from-indigo-500 via-indigo-400 to-violet-500"
                )}
                style={{ width: `${clampedProgress}%` }}
              >
                {status === 'processing' && (
                  <motion.div
                    initial={{ left: "-100%" }}
                    animate={{ left: "100%" }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                  />
                )}
              </motion.div>
            </div>
          </div>

          {/* Transparent Live Steps Checklist */}
          <div className="w-full space-y-2 pt-1 border-t border-zinc-900/80 text-left">
            {steps.map((step) => {
              const isCompleted = step.status === 'completed';
              const isActive = step.status === 'active';
              const isFailed = step.status === 'failed';

              return (
                <div key={step.id} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0 flex items-center justify-center">
                      {isCompleted ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                          <Check size={10} className="stroke-[3]" />
                        </div>
                      ) : isActive ? (
                        <div className="relative flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          <span className="absolute w-4 h-4 rounded-full bg-indigo-500/30 animate-ping" />
                        </div>
                      ) : isFailed ? (
                        <div className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center">
                          <X size={10} className="stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-zinc-800 flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-zinc-700" />
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "font-medium truncate transition-colors duration-200",
                      isCompleted ? "text-emerald-300 font-semibold" : isActive ? "text-white font-bold" : isFailed ? "text-rose-400 font-semibold" : "text-zinc-500"
                    )}>
                      {step.label}
                    </span>
                  </div>

                  <span className={cn(
                    "text-[10px] font-mono shrink-0 ml-2",
                    isCompleted ? "text-emerald-400" : isActive ? "text-indigo-400 font-bold" : isFailed ? "text-rose-400 font-bold" : "text-zinc-600"
                  )}>
                    {step.percent}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Action Buttons on Failure */}
          {status === 'error' && (
            <div className="flex items-center gap-3 w-full mt-6 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-300 font-bold text-xs tracking-wide transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/40 transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TransactionProcessingModal;
