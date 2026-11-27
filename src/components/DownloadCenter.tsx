import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DownloadCloud, 
  X, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  Trash2, 
  RefreshCw, 
  Info,
  Layers,
  Archive,
  Calendar,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Eye,
  Inbox
} from 'lucide-react';
import { backgroundExportManager, ExportTask, JobNotification } from '../services/exportManager';
import { cn } from '../lib/utils';

// Responsive and reactive named export for Download Center Trigger
export function DownloadCenterTrigger({ 
  theme, 
  isOpen, 
  setIsOpen 
}: { 
  theme: 'light' | 'dark'; 
  isOpen: boolean; 
  setIsOpen: (open: boolean) => void; 
}) {
  const [activeCounts, setActiveCounts] = useState({ pdf: 0, excel: 0, ai: 0, total: 0 });
  const [averageProgress, setAverageProgress] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      const tasks = backgroundExportManager.getTaskList().filter(t => !t.isArchived);
      const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'processing');
      
      const pdf = activeTasks.filter(t => t.type === 'pdf' || !t.type).length;
      const excel = activeTasks.filter(t => t.type === 'excel').length;
      const ai = activeTasks.filter(t => t.type === 'ai').length;
      
      setActiveCounts({ pdf, excel, ai, total: activeTasks.length });
      
      const avg = tasks.length > 0
        ? Math.round(tasks.reduce((acc, t) => acc + (t.status === 'completed' ? 100 : t.progress), 0) / tasks.length)
        : 0;
      setAverageProgress(avg);
    };

    handleUpdate();
    return backgroundExportManager.subscribe(handleUpdate);
  }, []);

  const handleVibrate = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(30);
      } catch (e) {}
    }
  };

  return (
    <button
      id="btn-download-center-trigger"
      onClick={() => { handleVibrate(); setIsOpen(!isOpen); }}
      className={cn(
        "relative p-2.5 rounded-xl outline-none transition-all cursor-pointer flex items-center justify-center group shrink-0",
        isOpen 
          ? "bg-indigo-600 border border-indigo-600 text-white shadow-sm" 
          : theme === 'dark'
          ? "bg-transparent text-slate-400 hover:text-white hover:bg-zinc-900"
          : "bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
      )}
      title={`Download Center (${activeCounts.pdf} PDF, ${activeCounts.excel} Excel, ${activeCounts.ai} AI Scan)`}
    >
      {/* Animated Progress Ring while processing */}
      {activeCounts.total > 0 && (
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-0.5 scale-[1.08] sm:scale-110">
          <circle
            cx="50%"
            cy="50%"
            r="44%"
            stroke="transparent"
            strokeWidth="2"
            fill="none"
          />
          <motion.circle
            cx="50%"
            cy="50%"
            r="44%"
            stroke={isOpen ? '#ffffff' : '#4f46e5'}
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="100"
            animate={{ strokeDashoffset: 100 - averageProgress }}
            transition={{ duration: 0.15 }}
          />
        </svg>
      )}

      {activeCounts.total > 0 ? (
        <Loader2 size={18} className={cn("animate-spin", isOpen ? "text-white" : "text-indigo-600 dark:text-indigo-400")} />
      ) : (
        <DownloadCloud size={18} className="transition-transform group-hover:scale-110" />
      )}

      {/* Active tasks badge pill */}
      {activeCounts.total > 0 && (
        <span 
          className="absolute -top-1.5 -right-1.5 bg-rose-500 border border-white dark:border-zinc-950 text-white font-extrabold text-[9px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center p-0.5 animate-pulse"
          title={`${activeCounts.pdf} PDF, ${activeCounts.excel} Excel, ${activeCounts.ai} AI pending`}
        >
          {activeCounts.total}
        </span>
      )}
    </button>
  );
}

interface DownloadCenterProps {
  theme: 'light' | 'dark';
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function DownloadCenter({ theme, isOpen, setIsOpen }: DownloadCenterProps) {
  const isDark = theme === 'dark';
  const [tasks, setTasks] = useState<ExportTask[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [activeFilter, setActiveFilter] = useState<'all' | 'export' | 'ai'>('all');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<JobNotification[]>([]);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Sync state with back-end export manager
  useEffect(() => {
    const handleUpdate = () => {
      const newTasks = backgroundExportManager.getTaskList();
      setNotifications(backgroundExportManager.getNotifications());
      
      setTasks(prevTasks => {
        // Simple premium Toast triggering for complete/fail transitions
        if (prevTasks.length > 0) {
          newTasks.forEach(task => {
            const old = prevTasks.find(t => t.id === task.id);
            if (!old) {
              if (task.type === 'ai') {
                triggerToast(`AI scanning queued...`, 'info');
              } else if (task.type === 'excel') {
                triggerToast(`Preparing Excel...`, 'info');
              } else {
                triggerToast(`Preparing PDF...`, 'info');
              }
            } else if (old.status !== task.status) {
              if (task.status === 'completed') {
                triggerToast(`Download ready`, 'success');
              } else if (task.status === 'failed') {
                triggerToast(`Failed to process "${task.cashbookName}"`, 'error');
              } else if (task.status === 'processing') {
                if (task.type === 'ai') {
                  triggerToast(`AI is scanning bills...`, 'info');
                } else if (task.type === 'excel') {
                  triggerToast(`Generating Excel spreadsheet...`, 'info');
                } else {
                  triggerToast(`Optimizing PDF attachments...`, 'info');
                }
              }
            }
          });
        }
        return newTasks;
      });
      
      const count = backgroundExportManager.getActiveTasksCount();
      setActiveCount(count);
    };

    setTasks(backgroundExportManager.getTaskList());
    setActiveCount(backgroundExportManager.getActiveTasksCount());
    setNotifications(backgroundExportManager.getNotifications());

    return backgroundExportManager.subscribe(handleUpdate);
  }, []);

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info') => {
    setShowToast({ message: msg, type });
    setTimeout(() => {
      setShowToast(null);
    }, 4500);
  };

  const handleDownload = (taskId: string) => {
    backgroundExportManager.downloadCompletedReport(taskId);
  };

  const handleRetry = (taskId: string) => {
    backgroundExportManager.retryTask(taskId);
  };

  const handleDelete = (taskId: string) => {
    backgroundExportManager.deleteReportTask(taskId);
  };

  const filteredTasks = tasks.filter(t => {
    // Tab filtering (Active vs Archive)
    if (activeTab === 'archive') {
      if (!t.isArchived) return false;
    } else {
      if (t.isArchived) return false;
    }

    // Type filtering
    if (activeFilter === 'export') {
      return t.type === 'pdf' || t.type === 'excel' || !t.type;
    }
    if (activeFilter === 'ai') {
      return t.type === 'ai';
    }
    return true;
  });

  return (
    <>
      {/* 1. NOTIFICATIONS PORTAL OVERLAY */}
      <div className="fixed top-20 right-4 z-[210] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
        <AnimatePresence>
          {notifications.map(notif => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={cn(
                "border p-4 rounded-2xl shadow-xl flex flex-col gap-3 pointer-events-auto",
                isDark
                  ? "bg-zinc-950 border-zinc-800 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex gap-2">
                  <div className={cn(
                    "p-1.5 rounded-xl text-white mt-0.5",
                    notif.type === 'ai' ? "bg-indigo-600" : notif.type === 'excel' ? "bg-emerald-600" : "bg-indigo-600"
                  )}>
                    {notif.type === 'ai' ? <Sparkles size={14} /> : notif.type === 'excel' ? <FileSpreadsheet size={14} /> : <FileText size={14} />}
                  </div>
                  <div>
                    <h5 className={cn("text-xs font-bold tracking-tight font-sans", isDark ? "text-white" : "text-slate-900")}>
                      {notif.type === 'ai' ? 'AI Scan Complete' : notif.type === 'excel' ? 'Excel Export Ready' : 'PDF Export Ready'}
                    </h5>
                    <p className={cn("text-[11px] font-medium leading-normal mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                      {notif.message}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => backgroundExportManager.dismissNotification(notif.id)}
                  className={cn(
                    "p-1 rounded-md transition-all cursor-pointer shrink-0",
                    isDark
                      ? "text-slate-400 hover:text-white hover:bg-zinc-900"
                      : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => backgroundExportManager.dismissNotification(notif.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border",
                    isDark
                      ? "text-slate-400 hover:text-white hover:bg-zinc-900 border-zinc-800"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200"
                  )}
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    backgroundExportManager.dismissNotification(notif.id);
                    if (notif.type === 'ai') {
                      if (backgroundExportManager.onReviewAiScan) {
                        backgroundExportManager.getAiScanResults(notif.taskId).then(results => {
                          backgroundExportManager.onReviewAiScan?.(results);
                        });
                      }
                    } else {
                      backgroundExportManager.downloadCompletedReport(notif.taskId);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                >
                  {notif.type === 'ai' ? 'Review Entries' : 'Download'}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 2. TOAST NOTIFICATIONS */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-6 left-1/2 z-[200] max-w-md w-full px-4 select-none pointer-events-none"
          >
            <div className={cn(
              "p-4 rounded-2xl shadow-xl flex items-center gap-3 border pointer-events-auto",
              isDark ? "bg-zinc-950" : "bg-white",
              showToast.type === 'success' 
                ? isDark ? "border-emerald-800/60 text-emerald-300" : "border-emerald-200 text-emerald-800"
                : showToast.type === 'error'
                ? isDark ? "border-rose-800/60 text-rose-300" : "border-rose-200 text-rose-800"
                : isDark ? "border-indigo-800/60 text-indigo-300" : "border-indigo-200 text-indigo-700"
            )}>
              {showToast.type === 'success' && <CheckCircle size={22} className="shrink-0 text-emerald-500" />}
              {showToast.type === 'error' && <AlertTriangle size={22} className="shrink-0 text-rose-500" />}
              {showToast.type === 'info' && <Loader2 size={22} className="shrink-0 text-indigo-500 animate-spin" />}
              
              <div className="flex-1 text-sm font-bold tracking-tight leading-snug">
                {showToast.message}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. DOWNLOAD CENTER DRAWER / PANEL */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click-away backdrop overlay */}
            <div 
              className={cn("fixed inset-0 z-[140]", isDark ? "bg-black/40" : "bg-slate-900/20")}
              onClick={() => { setIsOpen(false); setConfirmClearAll(false); }}
            />

            <motion.div
              id="download-center-panel"
              initial={{ opacity: 0, y: 15, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.96 }}
              className={cn(
                "fixed top-[70px] right-4 left-4 sm:left-auto sm:right-4 z-[150] w-auto sm:w-[420px] max-w-lg rounded-3xl p-5 border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all",
                isDark
                  ? "border-zinc-800 bg-zinc-950 text-slate-100"
                  : "border-slate-200 bg-white text-slate-900"
              )}
            >
              {/* Header block */}
              <div className={cn("flex items-center justify-between pb-3 border-b", isDark ? "border-zinc-800" : "border-slate-100")}>
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-xl", isDark ? "bg-indigo-950/70 text-indigo-400" : "bg-indigo-50 text-indigo-600")}>
                    <DownloadCloud size={18} />
                  </div>
                  <div>
                    <h4 className={cn("text-sm font-bold tracking-tight font-sans", isDark ? "text-white" : "text-slate-900")}>Download Center</h4>
                    <p className={cn("text-[10px] uppercase font-bold font-mono", isDark ? "text-slate-400" : "text-slate-500")}>Persistent Export Queue</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {confirmClearAll ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await backgroundExportManager.clearAllData();
                          setConfirmClearAll(false);
                          triggerToast('Local export queue cleared', 'info');
                        }}
                        className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Confirm Wipe
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmClearAll(false);
                        }}
                        className={cn(
                          "px-2 py-1 rounded font-bold text-[9px] uppercase tracking-wider transition-colors cursor-pointer",
                          isDark ? "bg-zinc-800 hover:bg-zinc-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        )}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmClearAll(true);
                      }}
                      className={cn(
                        "px-2 py-1 rounded font-bold text-[9px] uppercase tracking-wider transition-colors cursor-pointer border",
                        isDark
                          ? "bg-rose-950/40 hover:bg-rose-950/70 text-rose-400 border-rose-900/50"
                          : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200"
                      )}
                      title="Wipe local IndexedDB databases"
                    >
                      Clear All Data
                    </button>
                  )}
                  <button
                    onClick={() => { setIsOpen(false); setConfirmClearAll(false); }}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer",
                      isDark ? "text-slate-400 hover:text-slate-200 hover:bg-zinc-900" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Active / Archive Tabs */}
              <div className={cn("flex border-b mt-3 shrink-0", isDark ? "border-zinc-800" : "border-slate-100")}>
                <button
                  onClick={() => { setActiveTab('active'); setExpandedTaskId(null); }}
                  className={cn(
                    "flex-1 pb-2.5 text-xs font-bold tracking-tight text-center border-b-2 cursor-pointer transition-all",
                    activeTab === 'active'
                      ? isDark ? "border-indigo-500 text-indigo-400" : "border-indigo-600 text-indigo-600"
                      : isDark ? "border-transparent text-slate-400 hover:text-slate-200" : "border-transparent text-slate-500 hover:text-slate-900"
                  )}
                >
                  Processing Center ({tasks.filter(t => !t.isArchived).length})
                </button>
                <button
                  onClick={() => { setActiveTab('archive'); setExpandedTaskId(null); }}
                  className={cn(
                    "flex-1 pb-2.5 text-xs font-bold tracking-tight text-center border-b-2 cursor-pointer transition-all flex items-center justify-center gap-1.5",
                    activeTab === 'archive'
                      ? isDark ? "border-indigo-500 text-indigo-400" : "border-indigo-600 text-indigo-600"
                      : isDark ? "border-transparent text-slate-400 hover:text-slate-200" : "border-transparent text-slate-500 hover:text-slate-900"
                  )}
                >
                  <Archive size={13} />
                  Archive ({tasks.filter(t => t.isArchived).length})
                </button>
              </div>

              {/* Type Filter Buttons */}
              <div className="flex gap-1.5 py-2.5 overflow-x-auto scrollbar-none shrink-0">
                {(['all', 'export', 'ai'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all cursor-pointer border",
                      activeFilter === f
                        ? isDark
                          ? "bg-indigo-950/60 border-indigo-700/60 text-indigo-300"
                          : "bg-indigo-50 border-indigo-200 text-indigo-600"
                        : isDark
                        ? "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-slate-400"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500"
                    )}
                  >
                    {f === 'all' ? 'All Items' : f === 'export' ? 'Exports' : 'AI Scans'}
                  </button>
                ))}
              </div>

              {/* Task list container */}
              <div className="flex-1 overflow-y-auto py-1 space-y-3 pr-1 max-h-[45vh] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">
                {filteredTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                    <div className={cn("p-4 rounded-full", isDark ? "bg-indigo-950/60 text-indigo-400" : "bg-indigo-50 text-indigo-600")}>
                      <Inbox size={30} />
                    </div>
                    <div className="space-y-1">
                      <p className={cn("text-xs font-bold uppercase tracking-wider font-sans", isDark ? "text-white" : "text-slate-900")}>No tasks found</p>
                      <p className={cn("text-[11px] font-medium max-w-xs leading-relaxed font-sans", isDark ? "text-slate-400" : "text-slate-500")}>
                        {activeTab === 'active' 
                          ? "Run an export or AI scan to track progress." 
                          : "Your archived jobs will appear here."}
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const isProcessing = task.status === 'processing';
                    const isCompleted = task.status === 'completed';
                    const isFailed = task.status === 'failed';
                    const isPending = task.status === 'pending';
                    const isExpanded = expandedTaskId === task.id;

                    const taskType = task.type || 'pdf';
                    let TypeIcon = FileText;
                    if (taskType === 'excel') TypeIcon = FileSpreadsheet;
                    if (taskType === 'ai') TypeIcon = Sparkles;

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "p-3 rounded-2xl border transition-colors relative overflow-hidden group space-y-2 flex flex-col cursor-pointer",
                          isProcessing 
                            ? isDark ? "bg-indigo-950/30 border-indigo-800/50" : "bg-indigo-50/50 border-indigo-200"
                            : isFailed 
                            ? isDark ? "bg-rose-950/30 border-rose-900/50" : "bg-rose-50/60 border-rose-200"
                            : isPending 
                            ? isDark ? "bg-amber-950/30 border-amber-900/50" : "bg-amber-50/60 border-amber-200"
                            : isDark ? "bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800" : "bg-slate-50/50 hover:bg-slate-50 border-slate-200"
                        )}
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      >
                        {/* Status top row */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                            <div className={cn(
                              "p-1.5 rounded-lg shrink-0 flex items-center justify-center",
                              isCompleted 
                                ? isDark ? "bg-emerald-950/60 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                                : isFailed 
                                ? isDark ? "bg-rose-950/60 text-rose-400" : "bg-rose-50 text-rose-600"
                                : isProcessing
                                ? isDark ? "bg-indigo-950/60 text-indigo-400 animate-pulse" : "bg-indigo-50 text-indigo-600 animate-pulse"
                                : isDark ? "bg-amber-950/60 text-amber-400" : "bg-amber-50 text-amber-600"
                            )}>
                              {isCompleted && <CheckCircle size={15} />}
                              {isFailed && <AlertTriangle size={15} />}
                              {isProcessing && <Loader2 size={15} className="animate-spin" />}
                              {isPending && <Layers size={15} />}
                            </div>
                            
                            <div className="min-w-0 flex-1">
                              <h5 className={cn("text-xs font-bold tracking-tight truncate font-sans flex items-center gap-1.5", isDark ? "text-white" : "text-slate-900")} title={task.cashbookName}>
                                <TypeIcon size={12} className="shrink-0 text-slate-400" />
                                <span className="truncate">{task.cashbookName}</span>
                              </h5>
                              <p className={cn("text-[9px] font-bold uppercase tracking-widest leading-none mt-0.5 truncate font-mono flex items-center gap-1.5", isDark ? "text-slate-400" : "text-slate-500")}>
                                <span>{taskType.toUpperCase()} • {taskType === 'ai' ? `${task.attachmentsCount} Receipts` : `${task.transactionsCount} Entries`}</span>
                                {isProcessing && taskType === 'ai' && task.networkState && (
                                  <span className={cn(
                                    "text-[8px] font-extrabold tracking-widest rounded px-1.5 py-0.5 leading-none font-sans uppercase",
                                    task.networkState === 'offline' && "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 animate-pulse border border-rose-200 dark:border-rose-800",
                                    task.networkState === 'slow' && "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 animate-pulse border border-amber-200 dark:border-amber-800",
                                    task.networkState === 'good' && "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                  )}>
                                    {task.networkState}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Quick action controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            {isCompleted && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (taskType === 'ai') {
                                    if (backgroundExportManager.onReviewAiScan) {
                                      backgroundExportManager.getAiScanResults(task.id).then(results => {
                                        backgroundExportManager.onReviewAiScan?.(results);
                                      });
                                    }
                                  } else {
                                    handleDownload(task.id);
                                  }
                                }}
                                className={cn(
                                  "p-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
                                  taskType === 'ai' 
                                    ? isDark ? "bg-indigo-950/70 text-indigo-300 hover:bg-indigo-900/70 px-2 py-1" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1"
                                    : isDark ? "text-emerald-400 hover:bg-emerald-950/60" : "text-emerald-600 hover:bg-emerald-50"
                                )}
                                title={taskType === 'ai' ? "Review Scan" : "Download local file"}
                              >
                                {taskType === 'ai' ? (
                                  <>
                                    <Eye size={12} />
                                    <span>Review</span>
                                  </>
                                ) : (
                                  <DownloadCloud size={14} />
                                )}
                              </button>
                            )}
                            
                            {isFailed && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRetry(task.id); }}
                                className={cn("p-1 rounded-md transition-colors cursor-pointer", isDark ? "text-rose-400 hover:bg-rose-950/60" : "text-rose-600 hover:bg-rose-50")}
                                title="Retry process"
                              >
                                <RefreshCw size={13} />
                              </button>
                            )}

                            {/* Archive toggle */}
                            {(isCompleted || isFailed) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (task.isArchived) {
                                    backgroundExportManager.restoreTask(task.id);
                                    triggerToast('Job restored from archive', 'success');
                                  } else {
                                    backgroundExportManager.archiveTask(task.id);
                                    triggerToast('Job moved to archive', 'success');
                                  }
                                }}
                                className={cn(
                                  "p-1 rounded-md transition-colors cursor-pointer",
                                  isDark ? "text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/60" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                )}
                                title={task.isArchived ? "Restore to active queue" : "Archive job"}
                              >
                                <Archive size={13} />
                              </button>
                            )}
                            
                            {!isProcessing && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                                className={cn(
                                  "p-1 rounded-md transition-colors cursor-pointer",
                                  isDark ? "text-slate-400 hover:text-rose-400 hover:bg-rose-950/60" : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                )}
                                title="Delete task record"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Middle: Progress message/logs info */}
                        <div className="space-y-1.5">
                          <div className={cn("flex justify-between items-center text-[10px] font-bold uppercase tracking-widest gap-2", isDark ? "text-slate-400" : "text-slate-500")}>
                            <span className={cn(
                              "font-medium lowercase tracking-normal text-left leading-tight flex-1 min-w-0 truncate font-sans flex items-center gap-1.5",
                              isFailed && "text-rose-500 uppercase tracking-widest font-bold"
                            )}>
                              <span>{task.message}</span>
                              {isProcessing && task.aiTimeRemaining && (
                                <span className={cn("font-mono text-[9px] font-bold uppercase shrink-0 animate-pulse", isDark ? "text-indigo-400" : "text-indigo-600")}>
                                  ({task.aiTimeRemaining} remaining)
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-mono">{isCompleted ? '100' : task.progress}%</span>
                          </div>

                          {/* Horizontal progress bar */}
                          <div className={cn("w-full h-1.5 rounded-full overflow-hidden", isDark ? "bg-zinc-800" : "bg-slate-200/70")}>
                            <motion.div
                              className={cn(
                                "h-full rounded-full",
                                isCompleted 
                                  ? "bg-emerald-500" 
                                  : isFailed 
                                  ? "bg-rose-500" 
                                  : "bg-indigo-600 dark:bg-indigo-500"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${isCompleted ? 100 : task.progress}%` }}
                              transition={{ duration: 0.15 }}
                            />
                          </div>
                        </div>

                        {/* Expanded details accordion */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className={cn("border-t pt-2.5 mt-1 text-[11px] font-sans space-y-2", isDark ? "border-zinc-800 text-slate-400" : "border-slate-200 text-slate-500")}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <p className="text-[9px] uppercase font-bold text-slate-400 font-mono flex items-center gap-1">
                                    <Calendar size={10} /> Created
                                  </p>
                                  <p className={cn("font-semibold", isDark ? "text-slate-200" : "text-slate-900")}>
                                    {new Date(task.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[9px] uppercase font-bold text-slate-400 font-mono flex items-center gap-1">
                                    <Clock size={10} /> Duration
                                  </p>
                                  <p className={cn("font-semibold", isDark ? "text-slate-200" : "text-slate-900")}>
                                    {task.durationMs ? `${(task.durationMs / 1000).toFixed(1)}s` : isProcessing ? 'In progress...' : '-'}
                                  </p>
                                </div>
                              </div>

                              <div className={cn("grid grid-cols-2 gap-2 pt-1.5 border-t", isDark ? "border-zinc-800" : "border-slate-100")}>
                                <div className="space-y-1">
                                  <p className="text-[9px] uppercase font-bold text-slate-400 font-mono">Job Status</p>
                                  <p className={cn(
                                    "font-bold uppercase tracking-wider text-[10px]",
                                    isCompleted ? "text-emerald-500" : isFailed ? "text-rose-500" : "text-indigo-500"
                                  )}>
                                    {task.status}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  {taskType === 'ai' ? (
                                    <>
                                      <p className="text-[9px] uppercase font-bold text-slate-400 font-mono">Receipts Summary</p>
                                      <p className={cn("font-semibold", isDark ? "text-slate-200" : "text-slate-900")}>
                                        Total: {task.attachmentsCount} • Ok: {task.aiSuccessCount || 0} • Err: {task.aiFailedCount || 0}
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-[9px] uppercase font-bold text-slate-400 font-mono">Entries</p>
                                      <p className={cn("font-semibold", isDark ? "text-slate-200" : "text-slate-900")}>
                                        {task.transactionsCount} Transactions
                                      </p>
                                    </>
                                  )}
                                </div>
                              </div>

                              {task.error && (
                                <div className={cn(
                                  "p-1.5 rounded-lg border font-mono text-[9px] break-words",
                                  isDark ? "bg-rose-950/50 border-rose-900/60 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-600"
                                )}>
                                  Error: {task.error}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Banner tooltip/notice */}
              <div className={cn(
                "mt-2.5 p-3 rounded-2xl flex gap-2 border shrink-0",
                isDark
                  ? "bg-indigo-950/35 border-indigo-800/40"
                  : "bg-indigo-50/70 border-indigo-200/70"
              )}>
                <Info size={14} className={cn("shrink-0 mt-0.5", isDark ? "text-indigo-400" : "text-indigo-600")} />
                <p className={cn("text-[10px] font-medium leading-normal font-sans", isDark ? "text-slate-300" : "text-slate-700")}>
                  All PDF, Excel, and AI scanning compiles block-by-block asynchronously. You can switch books, add transactions, or close modals safely; our background queue takes care of everything.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
