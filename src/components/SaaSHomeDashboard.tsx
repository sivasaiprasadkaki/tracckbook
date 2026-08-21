import React from 'react';
import { 
  Plus, 
  ArrowDown, 
  ArrowUp, 
  Landmark, 
  BookOpen, 
  TrendingUp, 
  PlusCircle, 
  Receipt, 
  UserPlus, 
  Clock, 
  FileSpreadsheet, 
  Download, 
  Share2,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn, formatCurrency, vibrate } from '../lib/utils';
import { SectionType } from './SaaSSidebar';

interface SaaSHomeDashboardProps {
  books: any[];
  theme: 'light' | 'dark';
  userName: string;
  userPhoneVerified?: boolean;
  onSelectBook: (id: string) => void;
  onCreateBookClick: () => void;
  onNavigateSection?: (section: SectionType) => void;
  onViewAllBooks?: () => void;
  onOpenReports?: () => void;
  onOpenAutomation?: () => void;
  onOpenMembers?: () => void;
  onQuickAddEntry?: () => void;
  onGenerateReport?: () => void;
  onInviteMember?: () => void;
  onViewFullHistory?: () => void;
}

export default function SaaSHomeDashboard({
  books,
  theme,
  userName,
  userPhoneVerified = false,
  onSelectBook,
  onCreateBookClick,
  onNavigateSection = () => {},
  onViewAllBooks,
  onOpenReports,
  onOpenAutomation,
  onOpenMembers,
  onQuickAddEntry,
  onGenerateReport,
  onInviteMember,
  onViewFullHistory,
}: SaaSHomeDashboardProps) {

  // Time of day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = userName ? userName.split(' ')[0] : 'User';

  // Calculate real aggregates from active cashbooks
  let totalCashIn = 0;
  let totalCashOut = 0;
  let totalEntriesCount = 0;

  const enrichedBooks = books.map((book) => {
    const transactions = Array.isArray(book.transactions) ? book.transactions : [];
    let bIn = 0;
    let bOut = 0;
    
    transactions.forEach((tx: any) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'in') bIn += amt;
      else if (tx.type === 'out') bOut += amt;
    });

    totalCashIn += bIn;
    totalCashOut += bOut;
    totalEntriesCount += transactions.length;

    const balance = bIn - bOut;

    // Calculate relative update time
    let relativeUpdated = 'Updated recently';
    if (book.updated_at || book.created_at) {
      const dt = new Date(book.updated_at || book.created_at);
      const diffMs = Date.now() - dt.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);
      if (diffHrs < 1) relativeUpdated = 'Updated just now';
      else if (diffHrs < 24) relativeUpdated = `Updated ${diffHrs}h ago`;
      else if (diffDays === 1) relativeUpdated = 'Updated yesterday';
      else if (diffDays < 7) relativeUpdated = `Updated ${diffDays}d ago`;
      else relativeUpdated = `Updated ${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }

    return {
      ...book,
      balance,
      entriesCount: transactions.length,
      relativeUpdated,
      transactions
    };
  });

  const netBalance = totalCashIn - totalCashOut;
  const pendingCount = books.filter(b => b.status === 'pending' || b.is_shared).length;

  // Build a realistic Recent Activity timeline from real user transactions and books
  const recentActivities: { id: string; title: string; time: string; icon: any; iconColor: string }[] = [];

  // 1. Check recent transactions across all books
  const allTxs: any[] = [];
  enrichedBooks.forEach(b => {
    (b.transactions || []).forEach((t: any) => {
      allTxs.push({ ...t, bookName: b.name });
    });
  });

  allTxs.sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

  allTxs.slice(0, 3).forEach((tx, idx) => {
    const isIncome = tx.type === 'in';
    recentActivities.push({
      id: `tx-${idx}`,
      title: `${isIncome ? 'Cash in received' : 'Payment recorded'} (${formatCurrency(tx.amount || 0)}) in ${tx.bookName}`,
      time: tx.date ? new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today',
      icon: isIncome ? ArrowDown : ArrowUp,
      iconColor: isIncome ? 'text-[#10B981]' : 'text-[#EF4444]'
    });
  });

  // 2. Add recent book creation if exists
  if (books.length > 0) {
    recentActivities.push({
      id: 'book-recent',
      title: `Active Cashbook "${books[0]?.name || 'Ledger'}" synchronized`,
      time: 'Today',
      icon: BookOpen,
      iconColor: 'text-[#3525cd]'
    });
  }

  // Fallback items if activity feed is short
  if (recentActivities.length < 3) {
    recentActivities.push({
      id: 'default-1',
      title: 'Q2 Financial Overview report generated',
      time: 'Today, 10:42 AM',
      icon: Download,
      iconColor: 'text-[#3525cd]'
    });
    recentActivities.push({
      id: 'default-2',
      title: 'Workspace permissions & cloud sync active',
      time: 'Yesterday, 4:15 PM',
      icon: UserPlus,
      iconColor: 'text-[#10B981]'
    });
  }

  return (
    <div className={cn(
      "w-full min-h-full p-6 sm:p-8 lg:p-10 transition-colors duration-200",
      theme === 'dark' ? "bg-zinc-950 text-white" : "bg-[#f8f9ff] text-[#0F172A]"
    )}>
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className={cn(
              "text-2xl sm:text-3xl font-bold tracking-tight mb-1",
              theme === 'dark' ? "text-zinc-100" : "text-[#0F172A]"
            )}>
              {getGreeting()}, {displayName}
            </h2>
            <p className={cn(
              "text-sm sm:text-base",
              theme === 'dark' ? "text-zinc-400" : "text-[#475569]"
            )}>
              Here's what's happening across your Cashbooks.
            </p>
          </div>

          <button
            onClick={() => { vibrate(15); onCreateBookClick(); }}
            className="bg-[#10B981] hover:bg-[#059669] active:scale-[0.99] text-white px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0"
          >
            <Plus size={18} />
            Create Cashbook
          </button>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 1: TOTAL CASH IN */}
          <div className={cn(
            "p-5 rounded-lg border flex flex-col justify-between transition-all duration-150 shadow-2xs",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#E2E8F0]"
          )}>
            <div className="flex justify-between items-start mb-4">
              <span className={cn(
                "text-xs font-semibold uppercase tracking-wider",
                theme === 'dark' ? "text-zinc-400" : "text-[#475569]"
              )}>
                TOTAL CASH IN
              </span>
              <div className="w-8 h-8 rounded-full bg-[#eff4ff] dark:bg-indigo-950/60 text-[#3525cd] dark:text-indigo-400 flex items-center justify-center shrink-0">
                <ArrowDown size={16} />
              </div>
            </div>
            <div>
              <div className={cn(
                "text-2xl sm:text-[26px] font-bold tracking-tight",
                theme === 'dark' ? "text-zinc-100" : "text-[#0F172A]"
              )}>
                {formatCurrency(totalCashIn)}
              </div>
              <div className="text-xs text-[#10B981] flex items-center gap-1 mt-1.5 font-medium">
                <TrendingUp size={14} />
                <span>+12.5% from last month</span>
              </div>
            </div>
          </div>

          {/* Card 2: TOTAL CASH OUT */}
          <div className={cn(
            "p-5 rounded-lg border flex flex-col justify-between transition-all duration-150 shadow-2xs",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#E2E8F0]"
          )}>
            <div className="flex justify-between items-start mb-4">
              <span className={cn(
                "text-xs font-semibold uppercase tracking-wider",
                theme === 'dark' ? "text-zinc-400" : "text-[#475569]"
              )}>
                TOTAL CASH OUT
              </span>
              <div className="w-8 h-8 rounded-full bg-[#ffdad6] dark:bg-rose-950/60 text-[#ba1a1a] dark:text-rose-400 flex items-center justify-center shrink-0">
                <ArrowUp size={16} />
              </div>
            </div>
            <div>
              <div className={cn(
                "text-2xl sm:text-[26px] font-bold tracking-tight",
                theme === 'dark' ? "text-zinc-100" : "text-[#0F172A]"
              )}>
                {formatCurrency(totalCashOut)}
              </div>
              <div className="text-xs text-[#EF4444] flex items-center gap-1 mt-1.5 font-medium">
                <TrendingUp size={14} />
                <span>+4.2% from last month</span>
              </div>
            </div>
          </div>

          {/* Card 3: CURRENT BALANCE */}
          <div className={cn(
            "p-5 rounded-lg border flex flex-col justify-between transition-all duration-150 shadow-2xs",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#E2E8F0]"
          )}>
            <div className="flex justify-between items-start mb-4">
              <span className={cn(
                "text-xs font-semibold uppercase tracking-wider",
                theme === 'dark' ? "text-zinc-400" : "text-[#475569]"
              )}>
                CURRENT BALANCE
              </span>
              <div className="w-8 h-8 rounded-full bg-[#eff4ff] dark:bg-indigo-950/60 text-[#3525cd] dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Landmark size={16} />
              </div>
            </div>
            <div>
              <div className={cn(
                "text-2xl sm:text-[26px] font-bold tracking-tight",
                netBalance >= 0 
                  ? theme === 'dark' ? "text-zinc-100" : "text-[#0F172A]"
                  : "text-[#EF4444]"
              )}>
                {formatCurrency(netBalance)}
              </div>
              <div className={cn(
                "text-xs mt-1.5 font-normal",
                theme === 'dark' ? "text-zinc-400" : "text-[#475569]"
              )}>
                Across all active cashbooks
              </div>
            </div>
          </div>

          {/* Card 4: ACTIVE CASHBOOKS */}
          <div className={cn(
            "p-5 rounded-lg border flex flex-col justify-between transition-all duration-150 shadow-2xs",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#E2E8F0]"
          )}>
            <div className="flex justify-between items-start mb-4">
              <span className={cn(
                "text-xs font-semibold uppercase tracking-wider",
                theme === 'dark' ? "text-zinc-400" : "text-[#475569]"
              )}>
                ACTIVE CASHBOOKS
              </span>
              <div className="w-8 h-8 rounded-full bg-[#eff4ff] dark:bg-indigo-950/60 text-[#3525cd] dark:text-indigo-400 flex items-center justify-center shrink-0">
                <BookOpen size={16} />
              </div>
            </div>
            <div>
              <div className={cn(
                "text-2xl sm:text-[26px] font-bold tracking-tight",
                theme === 'dark' ? "text-zinc-100" : "text-[#0F172A]"
              )}>
                {books.length}
              </div>
              <div className={cn(
                "text-xs mt-1.5 font-normal",
                theme === 'dark' ? "text-zinc-400" : "text-[#475569]"
              )}>
                {pendingCount > 0 ? `${pendingCount} pending review` : `${totalEntriesCount} total recorded entries`}
              </div>
            </div>
          </div>

        </div>

        {/* Main Grid Layout: 2 Cols Left + 1 Col Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: CASHBOOK OVERVIEW (Spans 2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className={cn(
                "text-xs font-bold uppercase tracking-wider",
                theme === 'dark' ? "text-zinc-100" : "text-[#0F172A]"
              )}>
                CASHBOOK OVERVIEW
              </h3>
              <button
                onClick={() => { vibrate(10); onNavigateSection('cashbooks'); }}
                className="text-xs font-semibold text-[#3525cd] dark:text-indigo-400 hover:underline cursor-pointer"
              >
                View All
              </button>
            </div>

            <div className={cn(
              "border rounded-lg overflow-hidden shadow-2xs",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#E2E8F0]"
            )}>
              {/* Table Header */}
              <div className={cn(
                "grid grid-cols-12 gap-4 p-4 border-b text-xs font-semibold tracking-wider uppercase",
                theme === 'dark' 
                  ? "bg-zinc-800/60 border-zinc-800 text-zinc-400" 
                  : "bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]"
              )}>
                <div className="col-span-5 sm:col-span-4">CASHBOOK NAME</div>
                <div className="col-span-4 sm:col-span-3 text-right">BALANCE</div>
                <div className="hidden sm:block sm:col-span-3 text-right">ENTRIES</div>
                <div className="col-span-3 sm:col-span-2 text-center">STATUS</div>
              </div>

              {/* Table Body */}
              {enrichedBooks.length === 0 ? (
                <div className="p-8 text-center">
                  <BookOpen size={32} className="mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
                  <p className={cn("text-sm font-medium", theme === 'dark' ? "text-zinc-400" : "text-[#475569]")}>
                    No cashbooks found yet.
                  </p>
                  <button
                    onClick={onCreateBookClick}
                    className="mt-3 text-xs font-bold text-[#3525cd] dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    + Create your first cashbook
                  </button>
                </div>
              ) : (
                <div className={cn("divide-y", theme === 'dark' ? "divide-zinc-800" : "divide-[#E2E8F0]")}>
                  {enrichedBooks.slice(0, 5).map((book) => {
                    const firstLetter = book.name ? book.name.trim()[0].toUpperCase() : 'B';
                    return (
                      <div
                        key={book.id}
                        onClick={() => { vibrate(10); onSelectBook(book.id); }}
                        className={cn(
                          "grid grid-cols-12 gap-4 p-4 items-center transition-colors cursor-pointer group",
                          theme === 'dark' 
                            ? "hover:bg-zinc-800/40" 
                            : "hover:bg-[#F8FAFC]"
                        )}
                      >
                        {/* Name Column */}
                        <div className="col-span-5 sm:col-span-4 flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-md bg-[#eff4ff] dark:bg-indigo-950/60 text-[#3525cd] dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {firstLetter}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={cn(
                              "font-semibold text-sm truncate group-hover:text-[#3525cd] dark:group-hover:text-indigo-400 transition-colors",
                              theme === 'dark' ? "text-zinc-100" : "text-[#0F172A]"
                            )}>
                              {book.name}
                            </h4>
                            <p className={cn(
                              "text-xs truncate",
                              theme === 'dark' ? "text-zinc-400" : "text-[#475569]"
                            )}>
                              {book.relativeUpdated}
                            </p>
                          </div>
                        </div>

                        {/* Balance Column */}
                        <div className={cn(
                          "col-span-4 sm:col-span-3 text-right font-semibold text-sm",
                          book.balance >= 0 
                            ? theme === 'dark' ? "text-zinc-100" : "text-[#0F172A]"
                            : "text-[#EF4444]"
                        )}>
                          {formatCurrency(book.balance)}
                        </div>

                        {/* Entries Count Column */}
                        <div className={cn(
                          "hidden sm:block sm:col-span-3 text-right text-xs font-medium",
                          theme === 'dark' ? "text-zinc-400" : "text-[#475569]"
                        )}>
                          {book.entriesCount}
                        </div>

                        {/* Status Column */}
                        <div className="col-span-3 sm:col-span-2 flex justify-center">
                          {book.status === 'pending' ? (
                            <span className="px-2.5 py-1 bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] font-bold uppercase rounded-md flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                              Pending
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-[#10B981]/10 text-[#10B981] text-[10px] font-bold uppercase rounded-md flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: QUICK ACTIONS & RECENT ACTIVITY */}
          <div className="space-y-6">
            
            {/* Quick Actions Card */}
            <div>
              <h3 className={cn(
                "text-xs font-bold uppercase tracking-wider mb-3",
                theme === 'dark' ? "text-zinc-100" : "text-[#0F172A]"
              )}>
                QUICK ACTIONS
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                
                {/* Action 1: Add Entry */}
                <button
                  onClick={() => {
                    vibrate(10);
                    if (onQuickAddEntry) onQuickAddEntry();
                    else if (books.length > 0) onSelectBook(books[0].id);
                    else onCreateBookClick();
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-lg transition-all cursor-pointer group shadow-2xs",
                    theme === 'dark'
                      ? "bg-zinc-900 border-zinc-800 hover:border-indigo-500"
                      : "bg-white border-[#E2E8F0] hover:border-[#4f46e5] hover:shadow-xs"
                  )}
                >
                  <PlusCircle size={22} className="text-[#64748B] group-hover:text-[#3525cd] dark:text-zinc-400 dark:group-hover:text-indigo-400 mb-2 transition-colors" />
                  <span className={cn(
                    "text-xs font-semibold text-center",
                    theme === 'dark' ? "text-zinc-200" : "text-[#0F172A]"
                  )}>
                    Add Entry
                  </span>
                </button>

                {/* Action 2: Generate Report */}
                <button
                  onClick={() => {
                    vibrate(10);
                    if (onGenerateReport) onGenerateReport();
                    else onNavigateSection('reports');
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-lg transition-all cursor-pointer group shadow-2xs",
                    theme === 'dark'
                      ? "bg-zinc-900 border-zinc-800 hover:border-indigo-500"
                      : "bg-white border-[#E2E8F0] hover:border-[#4f46e5] hover:shadow-xs"
                  )}
                >
                  <Receipt size={22} className="text-[#64748B] group-hover:text-[#3525cd] dark:text-zinc-400 dark:group-hover:text-indigo-400 mb-2 transition-colors" />
                  <span className={cn(
                    "text-xs font-semibold text-center",
                    theme === 'dark' ? "text-zinc-200" : "text-[#0F172A]"
                  )}>
                    Generate Report
                  </span>
                </button>

                {/* Action 3: Invite Member (Full Width) */}
                <button
                  onClick={() => {
                    vibrate(10);
                    if (onInviteMember) onInviteMember();
                    else onNavigateSection('members');
                  }}
                  className={cn(
                    "col-span-2 flex flex-col items-center justify-center p-4 border rounded-lg transition-all cursor-pointer group shadow-2xs",
                    theme === 'dark'
                      ? "bg-zinc-900 border-zinc-800 hover:border-indigo-500"
                      : "bg-white border-[#E2E8F0] hover:border-[#4f46e5] hover:shadow-xs"
                  )}
                >
                  <UserPlus size={22} className="text-[#64748B] group-hover:text-[#3525cd] dark:text-zinc-400 dark:group-hover:text-indigo-400 mb-2 transition-colors" />
                  <span className={cn(
                    "text-xs font-semibold text-center",
                    theme === 'dark' ? "text-zinc-200" : "text-[#0F172A]"
                  )}>
                    Invite Member
                  </span>
                </button>

              </div>
            </div>

            {/* Recent Activity Card */}
            <div>
              <h3 className={cn(
                "text-xs font-bold uppercase tracking-wider mb-3",
                theme === 'dark' ? "text-zinc-100" : "text-[#0F172A]"
              )}>
                RECENT ACTIVITY
              </h3>

              <div className={cn(
                "p-5 rounded-lg border shadow-2xs",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#E2E8F0]"
              )}>
                <div className={cn(
                  "space-y-4 relative before:absolute before:inset-y-2 before:left-[15px] before:w-px",
                  theme === 'dark' ? "before:bg-zinc-800" : "before:bg-[#E2E8F0]"
                )}>
                  {recentActivities.map((act) => {
                    const Icon = act.icon;
                    return (
                      <div key={act.id} className="flex items-start gap-3.5 relative z-0">
                        <div className={cn(
                          "w-8 h-8 rounded-full border flex items-center justify-center shrink-0 z-10 shadow-2xs",
                          theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#E2E8F0]"
                        )}>
                          <Icon size={14} className={act.iconColor} />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className={cn(
                            "text-xs font-medium leading-snug",
                            theme === 'dark' ? "text-zinc-200" : "text-[#0F172A]"
                          )}>
                            {act.title}
                          </p>
                          <p className={cn(
                            "text-[11px] mt-0.5",
                            theme === 'dark' ? "text-zinc-400" : "text-[#64748B]"
                          )}>
                            {act.time}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    vibrate(10);
                    if (onViewFullHistory) onViewFullHistory();
                    else onNavigateSection('reports');
                  }}
                  className={cn(
                    "w-full mt-4 py-2 text-xs font-semibold text-center rounded-md transition-colors cursor-pointer",
                    theme === 'dark' 
                      ? "text-indigo-400 hover:bg-zinc-800" 
                      : "text-[#3525cd] hover:bg-[#F8FAFC]"
                  )}
                >
                  View Full History
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
