import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  FileText,
  Sparkles,
  Zap,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  ArrowRight,
  WifiOff
} from 'lucide-react';
import { backgroundExportManager, ExportTask } from '../services/exportManager';
import { cn } from '../lib/utils';

export interface PdfExportQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashbookId: string;
  cashbookName: string;
  transactions: any[];
  theme: 'light' | 'dark';
  onShowOfflineDialog?: () => void;
}

type QualityOption = 'original' | 'smart_compressed';
type ModalState = 'select' | 'generating' | 'ready' | 'error';

export function PdfExportQualityModal({
  isOpen,
  onClose,
  cashbookId,
  cashbookName,
  transactions,
  theme,
  onShowOfflineDialog
}: PdfExportQualityModalProps) {
  const [selectedQuality, setSelectedQuality] = useState<QualityOption>('original');
  const [state, setState] = useState<ModalState>('select');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Preparing your PDF...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [readyBlob, setReadyBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(() => 
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [showOfflineModalWarning, setShowOfflineModalWarning] = useState(false);

  const handleOfflineAttempt = () => {
    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
      try { (navigator as any).vibrate([30, 50, 30]); } catch {}
    }
    setShowOfflineModalWarning(true);
    if (onShowOfflineDialog) {
      onShowOfflineDialog();
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowOfflineModalWarning(false);
      setErrorMessage(null);
      setState(prev => prev === 'error' ? 'select' : prev);
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Calculate receipts/attachments count for dynamic feedback
  const totalReceipts = React.useMemo(() => {
    return transactions.reduce((acc, t) => acc + (t.images?.length || 0), 0);
  }, [transactions]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setState('select');
      setActiveTaskId(null);
      setProgress(0);
      setErrorMessage(null);
      setStatusMessage('Preparing your PDF...');
      setReadyBlob(null);
      setBlobUrl(null);
      const offline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
      setIsOffline(offline);
      setShowOfflineModalWarning(false);
    } else {
      if (blobUrl) {
        try { URL.revokeObjectURL(blobUrl); } catch (_) {}
        setBlobUrl(null);
      }
    }
  }, [isOpen]);

  // Subscribe to backgroundExportManager task updates
  useEffect(() => {
    if (!activeTaskId || state !== 'generating') return;

    const checkTask = () => {
      const task = backgroundExportManager.getTaskList().find(t => t.id === activeTaskId);
      if (!task) return;

      setProgress(task.progress || 0);

      // Dynamic contextual message
      if (task.message) {
        setStatusMessage(task.message);
      } else if (totalReceipts > 0) {
        setStatusMessage(`Optimizing ${totalReceipts} receipt${totalReceipts > 1 ? 's' : ''}...`);
      } else {
        setStatusMessage('Preparing your PDF...');
      }

      if (task.status === 'completed') {
        setProgress(100);
        setState('ready');
        backgroundExportManager.getBlob(activeTaskId).then(b => {
          if (b) {
            setReadyBlob(b);
            try {
              const url = URL.createObjectURL(b);
              setBlobUrl(url);
            } catch (_) {}
          }
        });
      } else if (task.status === 'failed') {
        setErrorMessage(task.error || 'Export encountered an issue. Please try again.');
        setState('error');
      }
    };

    checkTask();
    const unsubscribe = backgroundExportManager.subscribe(checkTask);
    return () => {
      unsubscribe();
    };
  }, [activeTaskId, state, totalReceipts]);

  const handleStartExport = async () => {
    try {
      setState('generating');
      setProgress(5);
      setStatusMessage(
        totalReceipts > 0
          ? selectedQuality === 'original'
            ? `Preparing ${totalReceipts} original receipt${totalReceipts > 1 ? 's' : ''}...`
            : `Optimizing ${totalReceipts} receipt${totalReceipts > 1 ? 's' : ''}...`
          : 'Compiling financial statement...'
      );

      const isCompressed = selectedQuality === 'smart_compressed';
      const taskId = await backgroundExportManager.enqueueTask(
        cashbookId,
        cashbookName,
        transactions,
        isCompressed
      );
      setActiveTaskId(taskId);
    } catch (err: any) {
      console.error('[PdfExportQualityModal] Error starting export:', err);
      setErrorMessage(err?.message || 'Failed to start PDF export.');
      setState('error');
    }
  };

  const handleDownload = async () => {
    const filename = `${cashbookName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    if (readyBlob) {
      backgroundExportManager.triggerDownload(filename, readyBlob);
      return;
    }
    if (activeTaskId) {
      try {
        await backgroundExportManager.downloadCompletedReport(activeTaskId);
      } catch (err) {
        console.error('[PdfExportQualityModal] Download trigger error:', err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="pdf-quality-modal-backdrop" 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      >
        <motion.div
          id="pdf-quality-modal-card"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={cn(
            "w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-colors",
            theme === 'dark' 
              ? "bg-zinc-950 border-zinc-800 text-slate-100" 
              : "bg-white border-slate-200 text-slate-800"
          )}
        >
          {/* Header */}
          <div className={cn(
            "px-6 py-4.5 border-b flex items-center justify-between",
            theme === 'dark' ? "border-zinc-800 bg-zinc-900/50" : "border-slate-100 bg-slate-50/70"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base tracking-tight leading-tight">
                  Choose PDF Quality
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {cashbookName} • {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
                  {totalReceipts > 0 && ` (${totalReceipts} receipt${totalReceipts === 1 ? '' : 's'})`}
                </p>
              </div>
            </div>
            {state !== 'generating' && (
              <button
                id="btn-close-pdf-quality-modal"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-150 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* 1. SELECTION STATE */}
            {state === 'select' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Select your preferred export quality. Your original cloud uploads remain permanently untouched.
                </p>

                <div className="space-y-3 pt-1">
                  {/* Option 1: Original Quality */}
                  <div
                    onClick={() => setSelectedQuality('original')}
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 relative flex items-start gap-3.5",
                      selectedQuality === 'original'
                        ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20"
                        : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-transparent"
                    )}
                  >
                    <div className="pt-0.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                        selectedQuality === 'original'
                          ? "border-indigo-600 bg-indigo-600"
                          : "border-slate-400 dark:border-zinc-600"
                      )}>
                        {selectedQuality === 'original' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          Original Quality
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-mono">
                          Best for records and archiving
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Export using the original uploaded files with maximum available quality.
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Smart Compressed */}
                  <div
                    onClick={() => setSelectedQuality('smart_compressed')}
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 relative flex items-start gap-3.5",
                      selectedQuality === 'smart_compressed'
                        ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20"
                        : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-transparent"
                    )}
                  >
                    <div className="pt-0.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                        selectedQuality === 'smart_compressed'
                          ? "border-indigo-600 bg-indigo-600"
                          : "border-slate-400 dark:border-zinc-600"
                      )}>
                        {selectedQuality === 'smart_compressed' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Zap size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          Smart Compressed
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-mono">
                          Best for WhatsApp, email and quick sharing
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Reduce PDF file size while keeping receipts and text clearly readable.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-zinc-800/80">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isOffline) {
                        handleOfflineAttempt();
                        return;
                      }
                      handleStartExport();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Download size={16} />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. GENERATING PROGRESS STATE */}
            {state === 'generating' && (
              <div className="py-6 flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                    <Loader2 size={32} className="animate-spin" />
                  </div>
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">
                    Generating PDF Statement
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium animate-pulse">
                    {statusMessage}
                  </p>
                </div>

                <div className="w-full max-w-xs space-y-1.5 pt-2">
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                    <motion.div
                      className="h-full bg-indigo-600 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "easeOut", duration: 0.2 }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>{selectedQuality === 'original' ? 'Original Quality' : 'Smart Compressed'}</span>
                    <span>{progress}%</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs pt-1">
                  You can keep TrackBook open; your download will trigger automatically when ready.
                </p>
              </div>
            )}

            {/* 3. READY STATE */}
            {state === 'ready' && (
              <div className="py-6 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                  <CheckCircle2 size={36} />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h4 className="font-bold text-lg text-slate-900 dark:text-white">
                    PDF Statement Ready!
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Your financial statement was generated with {selectedQuality === 'original' ? 'maximum original quality' : 'smart compression'}.
                  </p>
                </div>

                <div className="pt-3 flex flex-col sm:flex-row gap-2.5 w-full max-w-xs">
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Download size={16} />
                    <span>Download PDF</span>
                  </button>
                  {blobUrl && (
                    <a
                      href={blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink size={14} />
                      <span>Preview</span>
                    </a>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 pt-1 cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}

            {/* 4. ERROR STATE */}
            {state === 'error' && (
              <div className="py-6 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm">
                  <AlertCircle size={36} />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h4 className="font-bold text-lg text-slate-900 dark:text-white">
                    Export Failed
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {errorMessage || 'Unable to generate PDF report.'}
                  </p>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    onClick={() => setState('select')}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm cursor-pointer"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold text-xs sm:text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Dedicated Offline Warning Popup Dialog */}
        <AnimatePresence>
          {showOfflineModalWarning && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 15 }}
                transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                className={cn(
                  "w-full max-w-sm p-6 rounded-3xl shadow-2xl space-y-5 text-center border transition-all duration-300",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"
                )}
              >
                <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-inner">
                  <WifiOff size={26} className="stroke-[2.5]" />
                </div>
                
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <WifiOff size={13} />
                    Offline Mode
                  </div>
                  <h3 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                    You are Offline
                  </h3>
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 text-center">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300 leading-snug">
                      PDF reports cannot be downloaded while offline.
                    </p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1 font-medium">
                      Please reconnect to the internet to generate and download PDF reports.
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Generating PDF reports requires an active internet connection to download and render receipt attachments. As soon as you are reconnected, PDF download will work normally.
                  </p>
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900 text-[11px] text-slate-600 dark:text-slate-300 font-medium border border-slate-200/60 dark:border-zinc-800">
                    💡 <span className="font-semibold text-slate-800 dark:text-slate-200">Tip:</span> Excel (.xlsx) reports are fully supported offline.
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    id="btn-close-offline-pdf-modal-warning"
                    onClick={() => setShowOfflineModalWarning(false)}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-98"
                  >
                    Understood
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
