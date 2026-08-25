import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface DialogOptions {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  isDestructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface InAppDialogProps {
  isOpen: boolean;
  options: DialogOptions | null;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

export const InAppDialog: React.FC<InAppDialogProps> = ({
  isOpen,
  options,
  onClose,
  theme = 'light',
}) => {
  if (!isOpen || !options) return null;

  const isDark = theme === 'dark';
  const isConfirm = options.type === 'confirm' || Boolean(options.cancelText);

  const getIcon = () => {
    switch (options.type) {
      case 'success':
        return <CheckCircle2 className="text-emerald-500" size={28} />;
      case 'warning':
        return <AlertTriangle className="text-amber-500" size={28} />;
      case 'error':
        return <AlertCircle className="text-rose-500" size={28} />;
      case 'confirm':
        return options.isDestructive ? (
          <AlertCircle className="text-rose-500" size={28} />
        ) : (
          <Info className="text-indigo-500" size={28} />
        );
      default:
        return <Info className="text-indigo-500" size={28} />;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={cn(
            'relative w-full max-w-md p-6 rounded-3xl border shadow-2xl z-10 overflow-hidden',
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-white shadow-black/80'
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/20'
          )}
          id="in-app-dialog-modal"
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'p-3 rounded-2xl shrink-0',
                isDark ? 'bg-zinc-800/80' : 'bg-slate-100'
              )}
            >
              {getIcon()}
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-base font-bold tracking-tight">{options.title}</h3>
              <p
                className={cn(
                  'mt-1.5 text-xs font-medium leading-relaxed',
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                )}
              >
                {options.message}
              </p>
            </div>

            <button
              onClick={onClose}
              className={cn(
                'p-1.5 rounded-xl transition-colors shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-white',
                isDark ? 'hover:bg-zinc-800' : 'hover:bg-slate-100'
              )}
            >
              <X size={18} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-3">
            {isConfirm && (
              <button
                type="button"
                onClick={() => {
                  if (options.onCancel) options.onCancel();
                  onClose();
                }}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-xs font-bold transition-all',
                  isDark
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                )}
              >
                {options.cancelText || 'Cancel'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (options.onConfirm) options.onConfirm();
                onClose();
              }}
              className={cn(
                'px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md',
                options.isDestructive
                  ? 'bg-rose-600 hover:bg-rose-700 active:scale-95 shadow-rose-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-indigo-600/20'
              )}
            >
              {options.confirmText || 'OK'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default InAppDialog;
