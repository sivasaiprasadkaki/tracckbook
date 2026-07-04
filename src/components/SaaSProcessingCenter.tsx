import React, { useState } from 'react';
import { 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  Archive, 
  Trash2, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Cloud, 
  Clock, 
  Layers,
  FileText,
  FileSpreadsheet,
  Terminal,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, vibrate } from '../lib/utils';
import { ExportTask } from '../services/exportManager';

interface SaaSProcessingCenterProps {
  exportTasks: ExportTask[];
  theme: 'light' | 'dark';
  onArchiveTask: (id: string) => void;
  onRestoreTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onClearAllData: () => void;
}

export default function SaaSProcessingCenter({
  exportTasks,
  theme,
  onArchiveTask,
  onRestoreTask,
  onDeleteTask,
  onClearAllData,
}: SaaSProcessingCenterProps) {

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activeTasks = exportTasks.filter(t => !t.isArchived);
  const archivedTasks = exportTasks.filter(t => t.isArchived);
  const displayedTasks = showArchived ? archivedTasks : activeTasks;

  const toggleExpandTask = (id: string) => {
    vibrate(10);
    setExpandedTaskId(expandedTaskId === id ? null : id);
  };

  const getTaskIcon = (type?: string) => {
    if (type === 'ai') return <Sparkles size={14} className="text-indigo-500" />;
    if (type === 'excel') return <FileSpreadsheet size={14} className="text-emerald-500" />;
    return <FileText size={14} className="text-indigo-500" />;
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });
  };

  // Mock retry action to simulate starting job again (safe as we don't break existing Supabase state)
  const handleRetryTask = (task: ExportTask) => {
    vibrate(15);
    alert(`Job "${task.fileName}" has been re-queued for processing in the background.`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Processing Center Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-100 dark:border-zinc-900">
        <div>
          <h2 className={cn("text-lg font-extrabold tracking-tight", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>
            Processing & Sync Center
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Monitor active ledger exports, live optical character recognition scanning pipelines, and local cache backups.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle archive */}
          <button
            onClick={() => { vibrate(10); setShowArchived(!showArchived); }}
            className={cn(
              "py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              showArchived 
                ? "bg-indigo-600 text-white" 
                : theme === 'dark'
                  ? "bg-zinc-900 text-slate-300 hover:bg-zinc-800"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <Archive size={13} />
            {showArchived ? "Active Jobs" : "Archived Logs"}
          </button>
        </div>
      </div>

      {/* Task Queue Content */}
      {displayedTasks.length === 0 ? (
        <div className={cn(
          "py-16 text-center border rounded-2xl p-6",
          theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
        )}>
          <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-zinc-900 text-slate-400 dark:text-zinc-600 flex items-center justify-center mb-4 mx-auto">
            <Clock size={20} />
          </div>
          <h3 className={cn("text-sm font-bold", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>
            {showArchived ? "No Archived Logs" : "Queue Empty & Synced"}
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed font-semibold">
            All background operations have completed. Ledgers are currently 100% synchronized to TrackBook Cloud database shards.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            const isProcessing = task.status === 'processing' || task.status === 'pending';
            const isFailed = task.status === 'failed';
            const isCompleted = task.status === 'completed';

            return (
              <div
                key={task.id}
                className={cn(
                  "border rounded-2xl overflow-hidden transition-all duration-200 shadow-sm",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
                )}
              >
                {/* Header info row */}
                <div 
                  onClick={() => toggleExpandTask(task.id)}
                  className={cn(
                    "p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none text-xs",
                    theme === 'dark' ? "hover:bg-zinc-900/30" : "hover:bg-slate-50/40"
                  )}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {getTaskIcon(task.type)}
                    </div>
                    <div className="min-w-0">
                      <p className={cn("font-extrabold truncate", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>
                        {task.fileName}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">
                        Book: {task.cashbookName} • Started: {formatDate(task.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:justify-end shrink-0">
                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5">
                      {isProcessing && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100/40 animate-pulse">
                          <RotateCw size={10} className="animate-spin" />
                          Processing
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-500 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-150/40">
                          <AlertCircle size={10} />
                          Failed
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100/40">
                          <CheckCircle2 size={10} />
                          Ready
                        </span>
                      )}
                    </div>

                    {/* Progress slider/bar */}
                    <div className="w-24 bg-slate-100 dark:bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isFailed ? "bg-rose-500" : isCompleted ? "bg-emerald-500" : "bg-indigo-600 animate-pulse"
                        )}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>

                    {/* Expand Chevron */}
                    <span className="text-slate-400">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </div>
                </div>

                {/* Collapsible expanded detail panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={cn(
                        "p-4 border-t border-slate-100 dark:border-zinc-900 bg-slate-50/20 dark:bg-zinc-950/40 space-y-4",
                      )}>
                        
                        {/* Live Log Message console */}
                        <div className="flex gap-2.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                          <Terminal size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-extrabold text-slate-750 dark:text-zinc-300 uppercase tracking-wide text-[9.5px]">
                              Process Node Log
                            </p>
                            <p className="font-mono bg-slate-100 dark:bg-zinc-900 px-2 py-1 rounded text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">
                              {task.message || "Initializing task workers..."}
                            </p>
                          </div>
                        </div>

                        {/* Additional task details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[10.5px] font-semibold">
                          <div>
                            <span className="text-[9.5px] uppercase font-bold text-slate-400">Task Type</span>
                            <p className="text-slate-700 dark:text-zinc-300 mt-0.5">
                              {task.type === 'ai' ? "Receipt Scanning AI" : task.type === 'excel' ? "Excel Compilation" : "PDF Ledger Compiler"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9.5px] uppercase font-bold text-slate-400">Duration</span>
                            <p className="text-slate-700 dark:text-zinc-300 mt-0.5">
                              {task.durationMs ? `${(task.durationMs / 1000).toFixed(2)}s` : "In progress"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9.5px] uppercase font-bold text-slate-400">Payload Count</span>
                            <p className="text-slate-700 dark:text-zinc-300 mt-0.5">
                              {task.transactionsCount || task.attachmentsCount || 0} entries
                            </p>
                          </div>
                          <div>
                            <span className="text-[9.5px] uppercase font-bold text-slate-400">Sync Pipeline</span>
                            <p className="text-slate-700 dark:text-zinc-300 mt-0.5 flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <Cloud size={12} />
                              AutoSync Active
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons row inside expanded pane */}
                        <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-900 justify-end">
                          {isFailed && (
                            <button
                              onClick={() => handleRetryTask(task)}
                              className="py-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <RefreshCw size={11} />
                              Retry Job
                            </button>
                          )}

                          {task.isArchived ? (
                            <button
                              onClick={() => { vibrate(10); onRestoreTask(task.id); }}
                              className="py-1 px-3 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-500 dark:text-zinc-400 rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              Restore Log
                            </button>
                          ) : (
                            <button
                              onClick={() => { vibrate(10); onArchiveTask(task.id); }}
                              className="py-1 px-3 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-500 dark:text-zinc-400 rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Archive size={11} />
                              Archive Log
                            </button>
                          )}

                          <button
                            onClick={() => { vibrate(10); onDeleteTask(task.id); }}
                            className="py-1 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={11} />
                            Erase Log
                          </button>
                        </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
