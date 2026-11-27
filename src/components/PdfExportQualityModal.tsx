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

  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      <div 
        id="pdf-quality-modal-backdrop" 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs"
      >
        <motion.div
          id="pdf-quality-modal-card"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={cn(
            "w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-colors",
            isDark
              ? "border-zinc-800 bg-zinc-950 text-slate-100"
              : "border-slate-200 bg-white text-slate-900"
          )}
        >
          {/* Header */}
          <div className={cn(
            "px-6 py-4.5 border-b flex items-center justify-between",
            isDark ? "border-zinc-800 bg-zinc-900/60" : "border-slate-100 bg-slate-50/70"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <FileText size={20} />
              </div>
              <div>
                <h3 className={cn("font-bold text-base tracking-tight leading-tight", isDark ? "text-white" : "text-slate-900")}>
                  Choose PDF Quality
                </h3>
                <p className={cn("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                  {cashbookName} • {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
                  {totalReceipts > 0 && ` (${totalReceipts} receipt${totalReceipts === 1 ? '' : 's'})`}
                </p>
              </div>
            </div>
            {state !== 'generating' && (
              <button
                id="btn-close-pdf-quality-modal"
                onClick={onClose}
                className={cn(
                  "p-1.5 rounded-lg transition-colors cursor-pointer",
                  isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-zinc-800"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                )}
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
                <p className={cn("text-xs leading-relaxed font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                  Select your preferred export quality. Your original cloud uploads remain permanently untouched.
                </p>

                <div className="space-y-3 pt-1">
                  {/* Option 1: Original Quality */}
                  <div
                    onClick={() => setSelectedQuality('original')}
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 relative flex items-start gap-3.5",
                      selectedQuality === 'original'
                        ? isDark
                          ? "border-indigo-500 bg-indigo-950/35"
                          : "border-indigo-600 bg-indigo-50/50"
                        : isDark
                        ? "border-zinc-800 hover:border-zinc-700 bg-zinc-900/50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    )}
                  >
                    <div className="pt-0.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                        selectedQuality === 'original'
                          ? "border-indigo-600 bg-indigo-600"
                          : isDark ? "border-zinc-600" : "border-slate-400"
                      )}>
                        {selectedQuality === 'original' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Sparkles size={16} className={cn("shrink-0", isDark ? "text-indigo-400" : "text-indigo-600")} />
                        <h4 className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-900")}>
                          Original Quality
                        </h4>
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono",
                          isDark ? "bg-indigo-950/80 text-indigo-300" : "bg-indigo-50 text-indigo-600"
                        )}>
                          Best for records and archiving
                        </span>
                      </div>
                      <p className={cn("text-xs mt-1 leading-relaxed", isDark ? "text-slate-400" : "text-slate-500")}>
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
                        ? isDark
                          ? "border-indigo-500 bg-indigo-950/35"
                          : "border-indigo-600 bg-indigo-50/50"
                        : isDark
                        ? "border-zinc-800 hover:border-zinc-700 bg-zinc-900/50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    )}
                  >
                    <div className="pt-0.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                        selectedQuality === 'smart_compressed'
                          ? "border-indigo-600 bg-indigo-600"
                          : isDark ? "border-zinc-600" : "border-slate-400"
                      )}>
                        {selectedQuality === 'smart_compressed' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Zap size={16} className={cn("shrink-0", isDark ? "text-emerald-400" : "text-emerald-600")} />
                        <h4 className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-900")}>
                          Smart Compressed
                        </h4>
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono",
                          isDark ? "bg-emerald-950/80 text-emerald-300" : "bg-emerald-50 text-emerald-700"
                        )}>
                          Best for WhatsApp, email and quick sharing
                        </span>
                      </div>
                      <p className={cn("text-xs mt-1 leading-relaxed", isDark ? "text-slate-400" : "text-slate-500")}>
                        Reduce PDF file size while keeping receipts and text clearly readable.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={cn("pt-4 flex items-center justify-end gap-3 border-t", isDark ? "border-zinc-800" : "border-slate-100")}>
                  <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                      "px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer",
                      isDark ? "text-slate-400 hover:bg-zinc-900 hover:text-slate-200" : "text-slate-600 hover:bg-slate-100"
                    )}
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
                  <div className={cn(
                    "w-16 h-16 rounded-2xl border flex items-center justify-center shadow-sm",
                    isDark
                      ? "bg-indigo-950/60 border-indigo-800/60 text-indigo-400"
                      : "bg-indigo-50 border-indigo-200 text-indigo-600"
                  )}>
                    <Loader2 size={32} className="animate-spin" />
                  </div>
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h4 className={cn("font-bold text-base", isDark ? "text-white" : "text-slate-900")}>
                    Generating PDF Statement
                  </h4>
                  <p className={cn("text-xs sm:text-sm font-medium animate-pulse", isDark ? "text-slate-400" : "text-slate-500")}>
                    {statusMessage}
                  </p>
                </div>

                <div className="w-full max-w-xs space-y-1.5 pt-2">
                  <div className={cn("w-full h-2 rounded-full overflow-hidden", isDark ? "bg-zinc-800" : "bg-slate-100")}>
                    <motion.div
                      className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "easeOut", duration: 0.2 }}
                    />
                  </div>
                  <div className={cn("flex justify-between text-[11px] font-mono", isDark ? "text-slate-400" : "text-slate-500")}>
                    <span>{selectedQuality === 'original' ? 'Original Quality' : 'Smart Compressed'}</span>
                    <span>{progress}%</span>
                  </div>
                </div>

                <p className={cn("text-[11px] max-w-xs pt-1", isDark ? "text-slate-400" : "text-slate-500")}>
                  You can keep TrackBook open; your download will trigger automatically when ready.
                </p>
              </div>
            )}

            {/* 3. READY STATE */}
            {state === 'ready' && (
              <div className="py-6 flex flex-col items-center text-center space-y-4">
                <div className={cn(
                  "w-16 h-16 rounded-2xl border flex items-center justify-center shadow-sm",
                  isDark
                    ? "bg-emerald-950/50 border-emerald-800/60 text-emerald-400"
                    : "bg-emerald-50 border-emerald-200 text-emerald-600"
                )}>
                  <CheckCircle2 size={36} />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h4 className={cn("font-bold text-lg", isDark ? "text-white" : "text-slate-900")}>
                    PDF Statement Ready!
                  </h4>
                  <p className={cn("text-xs sm:text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
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
                      className={cn(
                        "py-2.5 px-4 rounded-xl border font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer",
                        isDark
                          ? "border-zinc-700 text-slate-200 hover:bg-zinc-900"
                          : "border-slate-200 text-slate-800 hover:bg-slate-50"
                      )}
                    >
                      <ExternalLink size={14} />
                      <span>Preview</span>
                    </a>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className={cn("text-xs pt-1 cursor-pointer", isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-900")}
                >
                  Done
                </button>
              </div>
            )}

            {/* 4. ERROR STATE */}
            {state === 'error' && (
              <div className="py-6 flex flex-col items-center text-center space-y-4">
                <div className={cn(
                  "w-16 h-16 rounded-2xl border flex items-center justify-center shadow-sm",
                  isDark
                    ? "bg-rose-950/50 border-rose-800/60 text-rose-400"
                    : "bg-rose-50 border-rose-200 text-rose-600"
                )}>
                  <AlertCircle size={36} />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h4 className={cn("font-bold text-lg", isDark ? "text-white" : "text-slate-900")}>
                    Export Failed
                  </h4>
                  <p className={cn("text-xs sm:text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
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
                    className={cn(
                      "px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm cursor-pointer",
                      isDark ? "text-slate-400 hover:bg-zinc-900" : "text-slate-600 hover:bg-slate-100"
                    )}
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
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-fade-in">
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 15 }}
                transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                className={cn(
                  "w-full max-w-sm p-6 rounded-3xl shadow-2xl space-y-5 text-center border transition-all duration-300",
                  isDark
                    ? "border-zinc-800 bg-zinc-950 text-slate-100"
                    : "border-slate-200 bg-white text-slate-900"
                )}
              >
                <div className={cn(
                  "mx-auto w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner",
                  isDark
                    ? "bg-amber-950/50 text-amber-400 border-amber-800/60"
                    : "bg-amber-50 text-amber-600 border-amber-200"
                )}>
                  <WifiOff size={26} className="stroke-[2.5]" />
                </div>
                
                <div className="space-y-3">
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                    isDark
                      ? "bg-amber-950/50 text-amber-400 border-amber-800/60"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  )}>
                    <WifiOff size={13} />
                    Offline Mode
                  </div>
                  <h3 className={cn("text-lg sm:text-xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                    You are Offline
                  </h3>
                  <div className={cn(
                    "p-3 rounded-2xl border text-center",
                    isDark ? "bg-amber-950/40 border-amber-800/50" : "bg-amber-50 border-amber-200"
                  )}>
                    <p className={cn("text-sm font-bold leading-snug", isDark ? "text-amber-300" : "text-amber-800")}>
                      PDF reports cannot be downloaded while offline.
                    </p>
                    <p className={cn("text-xs mt-1 font-medium", isDark ? "text-amber-400/90" : "text-amber-700")}>
                      Please reconnect to the internet to generate and download PDF reports.
                    </p>
                  </div>
                  <p className={cn("text-xs font-medium leading-relaxed", isDark ? "text-slate-400" : "text-slate-500")}>
                    Generating PDF reports requires an active internet connection to download and render receipt attachments. As soon as you are reconnected, PDF download will work normally.
                  </p>
                  <div className={cn(
                    "p-2.5 rounded-xl text-[11px] font-medium border",
                    isDark
                      ? "bg-zinc-900 text-slate-400 border-zinc-800"
                      : "bg-slate-50 text-slate-500 border-slate-200"
                  )}>
                    <span className={cn("font-semibold", isDark ? "text-slate-200" : "text-slate-900")}>Tip:</span> Excel (.xlsx) reports are fully supported offline.
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    id="btn-close-offline-pdf-modal-warning"
                    onClick={() => setShowOfflineModalWarning(false)}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
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
