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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-zinc-500 dark:text-zinc-400 font-medium">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Workspace</span>
            <ChevronRight size={12} />
            <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wide border border-emerald-250/20 dark:border-emerald-900/30">
              Default Workspace
            </span>
          </div>
          <h1 className={cn(
            "text-2xl font-bold tracking-tight",
            theme === 'dark' ? "text-zinc-100" : "text-zinc-900"
          )}>
            Welcome back, <span className="text-emerald-600 dark:text-emerald-400">{userName || 'Siva'}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 font-normal">
            <Calendar size={13} className="text-zinc-400" />
            {todayFormatted}
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigateSection('ai-upload')}
            className={cn(
              "py-2 px-3.5 rounded-sm text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer active:scale-[0.99] duration-150",
              theme === 'dark' 
                ? "bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800" 
                : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 shadow-sm"
            )}
          >
            <Sparkles size={14} className="text-emerald-500" />
            AI Scan Receipt
          </button>
          
          <button
            onClick={onCreateBookClick}
            className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.99] duration-150"
          >
            <Plus size={15} />
            New Cashbook
          </button>
        </div>
      </div>

      {/* Quick Stats Bento Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Card 1: Books & Entries count */}
        <div
          className={cn(
            "p-5 rounded-sm border transition-all duration-200 shadow-sm flex flex-col justify-between",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-550">
              Cashbooks
            </span>
            <div className="w-8 h-8 rounded-sm bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/10">
              <BookOpen size={15} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold tracking-tight">{totalBooks}</h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal mt-1">
              Active ledgers tracking {totalEntries} total ledger entries.
            </p>
          </div>
        </div>

        {/* Card 2: Cash In */}
        <div
          className={cn(
            "p-5 rounded-sm border transition-all duration-200 shadow-sm flex flex-col justify-between",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-550">
              Total Cash In
            </span>
            <div className="w-8 h-8 rounded-sm bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/10">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatCurrency(cashIn)}
            </h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal mt-1">
              Total revenues and cash deposits synced across books.
            </p>
          </div>
        </div>

        {/* Card 3: Cash Out */}
        <div
          className={cn(
            "p-5 rounded-sm border transition-all duration-200 shadow-sm flex flex-col justify-between",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-550">
              Total Cash Out
            </span>
            <div className="w-8 h-8 rounded-sm bg-rose-500/10 dark:bg-rose-400/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/10">
              <TrendingDown size={15} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
              {formatCurrency(cashOut)}
            </h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal mt-1">
              Expenses, payments, and cost transactions recorded.
            </p>
          </div>
        </div>

        {/* Card 4: Net Balance */}
        <div
          className={cn(
            "p-5 rounded-sm border transition-all duration-200 shadow-sm flex flex-col justify-between",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-550">
              Net Balance
            </span>
            <div className="w-8 h-8 rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center border border-zinc-200/50 dark:border-zinc-800/50">
              <Wallet size={15} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className={cn(
              "text-2xl font-bold tracking-tight",
              balance >= 0 ? "text-zinc-900 dark:text-zinc-50" : "text-rose-600"
            )}>
              {formatCurrency(balance)}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Database size={11} className="text-emerald-500 shrink-0" />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
                {storageUsedMB} MB of 500 MB cloud space used ({totalAttachments} attachments)
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Main Split Body: Left recent logs / Right quick view books */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left Side: Recent Activity Logs & Audit Feed (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className={cn(
            "p-5 sm:p-6 rounded-sm border shadow-sm transition-colors duration-300",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
          )}>
            <div className="flex items-center justify-between mb-4 border-b pb-3 border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-emerald-500" />
                <h3 className={cn("font-semibold text-sm", theme === 'dark' ? "text-zinc-100" : "text-zinc-800")}>
                  Recent Activity Audit Feed
                </h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-zinc-150 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-sm border border-zinc-250/20 dark:border-zinc-700/20">
                Live Feed
              </span>
            </div>

            {recentActivityFeed.length === 0 ? (
              <div className="text-center py-10 text-zinc-400 dark:text-zinc-500 text-xs font-semibold">
                No activity logged in this session yet. Your actions will record automatically.
              </div>
            ) : (
              <div className="relative border-l border-zinc-200 dark:border-zinc-800 ml-4 pl-6 space-y-6 py-1">
                {recentActivityFeed.map((act, i) => {
                  return (
                    <div key={i} className="relative group">
                      {/* Left Dot Bullet */}
                      <span className="absolute -left-[31px] top-1.5 flex items-center justify-center w-[10px] h-[10px] bg-emerald-600 border border-white dark:border-zinc-900 rounded-sm shadow-sm" />
                      
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5 min-w-0">
                          <p className={cn("text-xs font-semibold leading-none", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                            {act.title}
                          </p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal leading-relaxed">
                            {act.detail}
                          </p>
                        </div>
                        <span className="text-[9.5px] text-zinc-400 dark:text-zinc-500 font-medium shrink-0 whitespace-nowrap">
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
            "p-5 rounded-sm border flex items-center justify-between gap-4 transition-colors duration-200",
            theme === 'dark' 
              ? "bg-zinc-900 border-zinc-800" 
              : "bg-emerald-50/20 border-emerald-250/30 text-zinc-850"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-sm bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="min-w-0">
                <h4 className={cn("text-xs font-semibold leading-snug", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                  TrackBook Intelligent OCR AI Engine Active
                </h4>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal mt-0.5 leading-relaxed">
                  Import PDF reports or scan physical paper receipts. AI auto-detects vendor, amounts, taxes, and categorizes automatically.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateSection('ai-upload')}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-[10px] font-bold uppercase tracking-wider shrink-0 transition-colors cursor-pointer"
            >
              Scan
            </button>
          </div>
        </div>

        {/* Right Side: Quick Cashbooks list shortcuts (1 col) */}
        <div className="space-y-6">
          <div className={cn(
            "p-5 rounded-sm border shadow-sm transition-colors duration-300",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
          )}>
            <div className="flex items-center justify-between mb-4 border-b pb-3 border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-emerald-500" />
                <h3 className={cn("font-semibold text-sm", theme === 'dark' ? "text-zinc-100" : "text-zinc-850")}>
                  Active Ledgers ({books.length})
                </h3>
              </div>
              <button
                onClick={() => onNavigateSection('cashbooks')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-0.5"
              >
                View all
                <ChevronRight size={13} />
              </button>
            </div>

            {books.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-normal mb-3">No active cashbooks found.</p>
                <button
                  onClick={onCreateBookClick}
                  className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-sm cursor-pointer"
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
                        "p-3 rounded-sm border flex items-center justify-between gap-3 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors duration-150 group",
                        theme === 'dark' 
                          ? "bg-zinc-950/40 border-zinc-800 hover:bg-zinc-900" 
                          : "bg-zinc-50/50 border-zinc-200 hover:bg-zinc-100/50"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className={cn("text-xs font-semibold truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                          {book.name}
                        </h4>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-550 font-normal mt-0.5">
                          {book.transactions?.length || 0} entries inside
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={cn(
                          "text-xs font-semibold tracking-tight",
                          bookBalance >= 0 
                            ? theme === 'dark' ? "text-zinc-200" : "text-zinc-800"
                            : "text-rose-600"
                        )}>
                          {formatCurrency(bookBalance)}
                        </p>
                        <span className="text-[9px] uppercase font-semibold text-zinc-400 dark:text-zinc-550 flex items-center justify-end gap-0.5 mt-0.5">
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
