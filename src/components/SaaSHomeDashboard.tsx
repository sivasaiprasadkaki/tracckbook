import React from 'react';
import { 
  Sparkles, 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  BookOpen, 
  Plus, 
  ChevronRight, 
  Calendar, 
  Database, 
  Paperclip, 
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Share,
  Users
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { ExportTask } from '../services/exportManager';

interface SaaSHomeDashboardProps {
  books: any[];
  theme: 'light' | 'dark';
  userName: string;
  exportTasks: ExportTask[];
  onSelectBook: (id: string | null) => void;
  onCreateBookClick: () => void;
  onNavigateSection: (section: any) => void;
}

export default function SaaSHomeDashboard({
  books,
  theme,
  userName,
  exportTasks,
  onSelectBook,
  onCreateBookClick,
  onNavigateSection,
}: SaaSHomeDashboardProps) {

  // Global aggregate stats
  const totalBooks = books.length;
  const totalEntries = books.reduce((acc, b) => acc + (b.transactions?.length || 0), 0);
  
  const cashIn = books.reduce((acc, b) => {
    const sum = (b.transactions || []).filter((t: any) => t.type === 'in').reduce((s: number, t: any) => s + (t.amount || 0), 0);
    return acc + sum;
  }, 0);

  const cashOut = books.reduce((acc, b) => {
    const sum = (b.transactions || []).filter((t: any) => t.type === 'out').reduce((s: number, t: any) => s + (t.amount || 0), 0);
    return acc + sum;
  }, 0);

  const balance = cashIn - cashOut;

  const totalAttachments = books.reduce((acc, b) => {
    const sum = (b.transactions || []).reduce((s: number, t: any) => s + (t.images?.length || 0), 0);
    return acc + sum;
  }, 0);

  // Storage calculation: Assume average of 380KB per receipt
  const storageUsedMB = (totalAttachments * 0.38).toFixed(1);

  // Today's Date formatting
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date());

  // Recent AI Scan Tasks from ExportManager (queued or historical)
  const recentAiScans = exportTasks.filter(t => t.type === 'ai').slice(0, 4);
  const recentExports = exportTasks.filter(t => t.type === 'pdf' || t.type === 'excel').slice(0, 4);

  // Recent shared entries or imports (Mock data or real if we track it, let's create custom feeds!)
  const recentActivityFeed = React.useMemo(() => {
    const feed: any[] = [];
    
    // 1. Book creation logs
    books.forEach(b => {
      feed.push({
        type: 'book_create',
        title: `Cashbook "${b.name}" created`,
        time: b.createdAt ? new Date(b.createdAt) : new Date(Date.now() - 2 * 60 * 60 * 1000),
        detail: `${b.transactions?.length || 0} entries inside`,
        icon: BookOpen,
        color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400'
      });
    });

    // 2. Export logs
    recentExports.forEach(t => {
      feed.push({
        type: 'export',
        title: `${t.type?.toUpperCase()} Export ready: ${t.fileName}`,
        time: t.completedAt ? new Date(t.completedAt) : new Date(t.createdAt),
        detail: `${t.transactionsCount} entries, status: ${t.status}`,
        icon: t.type === 'excel' ? FileSpreadsheet : FileText,
        color: t.status === 'completed' 
          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400' 
          : 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400'
      });
    });

    // 3. AI scan logs
    recentAiScans.forEach(t => {
      feed.push({
        type: 'ai_scan',
        title: `AI Scanning Batch: ${t.fileName}`,
        time: t.completedAt ? new Date(t.completedAt) : new Date(t.createdAt),
        detail: `${t.aiSuccessCount || 0} receipts parsed successfully`,
        icon: Sparkles,
        color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400'
      });
    });

    // Sort descending
    feed.sort((a, b) => b.time.getTime() - a.time.getTime());
    return feed.slice(0, 6);
  }, [books, recentExports, recentAiScans]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      
      {/* Top Banner section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 border-slate-100 dark:border-zinc-900">
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-slate-500 dark:text-slate-400 font-medium">
            <span className="text-xs uppercase tracking-wider font-bold">Workspace</span>
            <ChevronRight size={14} />
            <span className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide border border-indigo-100 dark:border-indigo-900/20">
              Default Workspace
            </span>
          </div>
          <h1 className={cn(
            "text-2xl sm:text-3xl font-black tracking-tight",
            theme === 'dark' ? "text-slate-100" : "text-slate-900"
          )}>
            Welcome back, <span className="text-indigo-600 dark:text-indigo-400">{userName || 'Siva'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
            <Calendar size={13} />
            {todayFormatted}
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigateSection('ai-upload')}
            className={cn(
              "py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95 duration-150",
              theme === 'dark' 
                ? "bg-zinc-900 border border-zinc-800 text-slate-200 hover:bg-zinc-800" 
                : "bg-white border border-slate-150 text-slate-700 hover:bg-slate-50 shadow-sm"
            )}
          >
            <Sparkles size={14} className="text-indigo-500" />
            AI Scan Receipt
          </button>
          
          <button
            onClick={onCreateBookClick}
            className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer active:scale-95 duration-150"
          >
            <Plus size={15} />
            New Cashbook
          </button>
        </div>
      </div>

      {/* Quick Stats Bento Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Card 1: Books & Entries count */}
        <motion.div
          whileHover={{ y: -3 }}
          className={cn(
            "p-5 rounded-2xl border transition-all duration-200 shadow-sm flex flex-col justify-between",
            theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              Cashbooks
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <BookOpen size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black tracking-tight">{totalBooks}</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Active ledgers tracking {totalEntries} total ledger entries.
            </p>
          </div>
        </motion.div>

        {/* Card 2: Cash In */}
        <motion.div
          whileHover={{ y: -3 }}
          className={cn(
            "p-5 rounded-2xl border transition-all duration-200 shadow-sm flex flex-col justify-between",
            theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              Total Cash In
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatCurrency(cashIn)}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Total revenues and cash deposits synced across books.
            </p>
          </div>
        </motion.div>

        {/* Card 3: Cash Out */}
        <motion.div
          whileHover={{ y: -3 }}
          className={cn(
            "p-5 rounded-2xl border transition-all duration-200 shadow-sm flex flex-col justify-between",
            theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              Total Cash Out
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 dark:bg-rose-400/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
              {formatCurrency(cashOut)}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Expenses, payments, and cost transactions recorded.
            </p>
          </div>
        </motion.div>

        {/* Card 4: Net Balance */}
        <motion.div
          whileHover={{ y: -3 }}
          className={cn(
            "p-5 rounded-2xl border transition-all duration-200 shadow-sm flex flex-col justify-between",
            theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              Net Balance
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Wallet size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className={cn(
              "text-3xl font-black tracking-tight",
              balance >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600"
            )}>
              {formatCurrency(balance)}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Database size={12} className="text-indigo-500 shrink-0" />
              <p className="text-[11px] text-slate-400 font-medium">
                {storageUsedMB} MB of 500 MB cloud space used ({totalAttachments} attachments)
              </p>
            </div>
          </div>
        </motion.div>

      </div>

      {/* Main Split Body: Left recent logs / Right quick view books */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left Side: Recent Activity Logs & Audit Feed (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className={cn(
            "p-5 sm:p-6 rounded-2xl border shadow-sm transition-colors duration-300",
            theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
          )}>
            <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-100 dark:border-zinc-900">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-indigo-500" />
                <h3 className={cn("font-bold text-sm", theme === 'dark' ? "text-slate-100" : "text-slate-800")}>
                  Recent Activity Audit Feed
                </h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-widest bg-slate-100 text-slate-500 dark:bg-zinc-900 dark:text-zinc-400 px-2 py-0.5 rounded-md">
                Live Feed
              </span>
            </div>

            {recentActivityFeed.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                No activity logged in this session yet. Your actions will record automatically.
              </div>
            ) : (
              <div className="relative border-l border-slate-150 dark:border-zinc-900 ml-4 pl-6 space-y-6 py-1">
                {recentActivityFeed.map((act, i) => {
                  const Icon = act.icon;
                  return (
                    <div key={i} className="relative group">
                      {/* Left Dot Bullet */}
                      <span className="absolute -left-[31px] top-0.5 flex items-center justify-center w-[11px] h-[11px] bg-indigo-600 border border-white dark:border-zinc-950 rounded-full ring-4 ring-indigo-50 dark:ring-indigo-950/20" />
                      
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5 min-w-0">
                          <p className={cn("text-xs font-bold leading-none", theme === 'dark' ? "text-slate-250" : "text-slate-850")}>
                            {act.title}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            {act.detail}
                          </p>
                        </div>
                        <span className="text-[9.5px] text-slate-400 font-medium shrink-0 whitespace-nowrap">
                          {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).format(act.time)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Stats Summary Banner */}
          <div className={cn(
            "p-5 rounded-2xl border flex items-center justify-between gap-4 transition-colors duration-200",
            theme === 'dark' 
              ? "bg-gradient-to-r from-zinc-950 to-zinc-900 border-zinc-900" 
              : "bg-gradient-to-r from-indigo-50/40 to-indigo-50/10 border-indigo-100/50"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/10 shrink-0">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <h4 className={cn("text-xs font-bold leading-snug", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>
                  TrackBook Intelligent OCR AI Engine Active
                </h4>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                  Import PDF reports or scan physical paper receipts. AI auto-detects vendor, amounts, taxes, and categorizes automatically.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateSection('ai-upload')}
              className="py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wide shrink-0 transition-colors cursor-pointer"
            >
              Scan
            </button>
          </div>
        </div>

        {/* Right Side: Quick Cashbooks list shortcuts (1 col) */}
        <div className="space-y-6">
          <div className={cn(
            "p-5 rounded-2xl border shadow-sm transition-colors duration-300",
            theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
          )}>
            <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-100 dark:border-zinc-900">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-indigo-500" />
                <h3 className={cn("font-bold text-sm", theme === 'dark' ? "text-slate-100" : "text-slate-800")}>
                  Active Ledgers ({books.length})
                </h3>
              </div>
              <button
                onClick={() => onNavigateSection('cashbooks')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-0.5"
              >
                View all
                <ChevronRight size={13} />
              </button>
            </div>

            {books.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-slate-400 font-medium mb-3">No active cashbooks found.</p>
                <button
                  onClick={onCreateBookClick}
                  className="py-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                >
                  Create your first book
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {books.slice(0, 5).map((book) => {
                  const bookIn = (book.transactions || []).filter((t: any) => t.type === 'in').reduce((s: number, t: any) => s + (t.amount || 0), 0);
                  const bookOut = (book.transactions || []).filter((t: any) => t.type === 'out').reduce((s: number, t: any) => s + (t.amount || 0), 0);
                  const bookBalance = bookIn - bookOut;
                  
                  return (
                    <div
                      key={book.id}
                      onClick={() => onSelectBook(book.id)}
                      className={cn(
                        "p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer hover:scale-[1.015] active:scale-99 transition-all group",
                        theme === 'dark' 
                          ? "bg-zinc-900/40 border-zinc-900 hover:bg-zinc-900 hover:border-zinc-800" 
                          : "bg-slate-50/30 border-slate-150 hover:bg-slate-50 hover:border-slate-200"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className={cn("text-xs font-bold truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>
                          {book.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          {book.transactions?.length || 0} entries inside
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={cn(
                          "text-xs font-extrabold tracking-tight",
                          bookBalance >= 0 
                            ? theme === 'dark' ? "text-slate-200" : "text-slate-800"
                            : "text-rose-600"
                        )}>
                          {formatCurrency(bookBalance)}
                        </p>
                        <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center justify-end gap-0.5 mt-0.5">
                          Open <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
