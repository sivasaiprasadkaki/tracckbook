import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  Minus,
  BookPlus,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  BookOpen,
  Calendar,
  ArrowRight,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  TimePeriodFilter,
  AnalyticsBook,
  flattenBooksTransactions,
  filterAnalyticsTransactions,
  computeLedgerTotals,
  buildCashFlowSeries,
  buildMonthlyIncomeExpenseSeries,
  buildCashbookDistribution,
  buildCategoryExpenseBreakdown,
  getRecentTransactions,
  formatINR,
  slugifyBookName,
} from '../utils/analytics';
import {
  CashFlowOverviewChart,
  MonthlyIncomeExpenseChart,
  CashbookDistributionChart,
  CategoryExpenseChart,
} from '../components/charts/DashboardCharts';

interface DashboardHomeProps {
  userName: string;
  books: AnalyticsBook[];
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdatedAt: Date | null;
  error: string | null;
  onRefresh: () => void;
  onOpenQuickTransaction: (type: 'in' | 'out', bookId?: string | null) => void;
  onOpenCreateBook: () => void;
  onSelectBook: (bookId: string, slug?: string) => void;
  onNavigateCashbooks: () => void;
}

const PERIOD_OPTIONS: Array<{ id: TimePeriodFilter; label: string }> = [
  { id: 'all', label: 'All Time' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom' },
];

export default function DashboardHome({
  userName,
  books,
  isLoading,
  isRefreshing,
  lastUpdatedAt,
  error,
  onRefresh,
  onOpenQuickTransaction,
  onOpenCreateBook,
  onSelectBook,
  onNavigateCashbooks,
}: DashboardHomeProps) {
  const [period, setPeriod] = useState<TimePeriodFilter>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const allFlattened = useMemo(() => flattenBooksTransactions(books), [books]);

  const filteredTransactions = useMemo(
    () =>
      filterAnalyticsTransactions(allFlattened, {
        period,
        startDate: customStart,
        endDate: customEnd,
      }),
    [allFlattened, period, customStart, customEnd]
  );

  const totals = useMemo(() => computeLedgerTotals(filteredTransactions), [filteredTransactions]);

  const cashFlowSeries = useMemo(
    () => buildCashFlowSeries(filteredTransactions, period),
    [filteredTransactions, period]
  );

  const monthlySeries = useMemo(
    () => buildMonthlyIncomeExpenseSeries(filteredTransactions, 12),
    [filteredTransactions]
  );

  const cashbookDistribution = useMemo(
    () => buildCashbookDistribution(books, period, customStart, customEnd),
    [books, period, customStart, customEnd]
  );

  const categoryExpenses = useMemo(
    () => buildCategoryExpenseBreakdown(filteredTransactions, 8),
    [filteredTransactions]
  );

  const recentTransactions = useMemo(
    () => getRecentTransactions(filteredTransactions, 10),
    [filteredTransactions]
  );

  const highestExpenseCategories = useMemo(
    () => categoryExpenses.slice(0, 5),
    [categoryExpenses]
  );

  const kpiCards = [
    {
      label: 'Total Cash In',
      value: formatINR(totals.in),
      subtitle: `${filteredTransactions.filter((t) => t.type === 'in').length} credit entries`,
      accentBg: 'bg-emerald-50 text-[#21B987]',
      valueClass: 'text-[#21B987]',
      icon: ArrowUpRight,
    },
    {
      label: 'Total Cash Out',
      value: formatINR(totals.out),
      subtitle: `${filteredTransactions.filter((t) => t.type === 'out').length} debit entries`,
      accentBg: 'bg-orange-50 text-[#F07858]',
      valueClass: 'text-[#F07858]',
      icon: ArrowDownRight,
    },
    {
      label: 'Overall Net Balance',
      value: formatINR(totals.net, { signed: totals.net < 0 }),
      subtitle: totals.net >= 0 ? 'Positive net position' : 'Net deficit balance',
      accentBg: 'bg-[#EAF2FF] text-[#2866C7]',
      valueClass: totals.net >= 0 ? 'text-[#2866C7]' : 'text-[#F07858]',
      icon: Wallet,
    },
    {
      label: 'Total Cashbooks',
      value: String(books.length),
      subtitle: `${totals.count} transactions tracked`,
      accentBg: 'bg-[#EAF2FF] text-[#2866C7]',
      valueClass: 'text-[#263445]',
      icon: BookOpen,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Greeting + Period Filters + Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-[#263445] tracking-tight">
              Welcome back, <span className="text-[#2866C7]">{userName || 'User'}</span>
            </h2>
            <div className="flex items-center gap-3 text-xs text-[#748197] flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} />
                Last Updated:{' '}
                {lastUpdatedAt
                  ? lastUpdatedAt.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Syncing...'}
              </span>
              <span>·</span>
              <span>Currency: INR (₹)</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-[#263445] transition-colors min-h-[40px]"
            >
              <RefreshCw size={14} className={cn(isRefreshing && 'animate-spin text-[#2866C7]')} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickTransaction('in')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#21B987] hover:bg-emerald-600 text-white text-xs sm:text-sm font-medium transition-colors shadow-xs min-h-[40px]"
            >
              <Plus size={16} />
              <span>Cash In</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickTransaction('out')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F07858] hover:bg-orange-600 text-white text-xs sm:text-sm font-medium transition-colors shadow-xs min-h-[40px]"
            >
              <Minus size={16} />
              <span>Cash Out</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreateBook}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#2866C7] hover:bg-[#2058A8] text-white text-xs sm:text-sm font-medium transition-colors shadow-xs min-h-[40px]"
            >
              <BookPlus size={16} />
              <span>Create Book</span>
            </button>
          </div>
        </div>

        {/* Date Period Filter Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriod(opt.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                    active
                      ? 'bg-[#2866C7] text-white'
                      : 'bg-[#F1F5F9] text-[#748197] hover:bg-[#EAF2FF] hover:text-[#2866C7]'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Calendar size={14} className="text-[#2866C7]" />
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="Start date"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#263445] outline-none focus:border-[#2866C7]"
              />
              <span className="text-[#748197]">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="End date"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#263445] outline-none focus:border-[#2866C7]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Error Recovery Banner if needed */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs sm:text-sm text-rose-700">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: idx * 0.045 }}
              className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-[#748197]">{card.label}</p>
                {isLoading ? (
                  <div className="h-7 w-28 rounded-lg bg-slate-100 animate-pulse mt-1" />
                ) : (
                  <p className={cn('text-xl sm:text-2xl font-bold font-mono tabular-nums truncate', card.valueClass)}>
                    {card.value}
                  </p>
                )}
                <p className="text-[11px] text-[#748197] truncate">{card.subtitle}</p>
              </div>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', card.accentBg)}>
                <Icon size={20} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty CTA Banner if 0 cashbooks */}
      {!isLoading && books.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#EAF2FF] text-[#2866C7] flex items-center justify-center mx-auto">
            <BookOpen size={28} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-[#263445]">Create your first cashbook</h3>
            <p className="text-xs sm:text-sm text-[#748197]">
              Organize daily cash flow, upload PDF or image receipts, and inspect real-time financial charts in INR (₹).
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCreateBook}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2866C7] hover:bg-[#2058A8] text-white text-sm font-medium transition-colors"
          >
            <BookPlus size={17} />
            <span>Create a Cashbook</span>
          </button>
        </div>
      )}

      {/* 4 Interactive Recharts Visualizations (2x2 Grid) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        <CashFlowOverviewChart data={cashFlowSeries} isLoading={isLoading} />
        <MonthlyIncomeExpenseChart data={monthlySeries} isLoading={isLoading} />
        <CashbookDistributionChart
          items={cashbookDistribution.items}
          mode={cashbookDistribution.mode}
          isLoading={isLoading}
          onSelectBook={(bookId, slug) => onSelectBook(bookId, slug)}
        />
        <CategoryExpenseChart data={categoryExpenses} isLoading={isLoading} />
      </div>

      {/* Operational Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5">
        {/* Recent Transactions */}
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#263445]">Recent Transactions</h3>
              <p className="text-xs text-[#748197]">Latest entries across your cashbooks</p>
            </div>
            <button
              type="button"
              onClick={onNavigateCashbooks}
              className="text-xs font-medium text-[#2866C7] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>All Books</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#748197] border border-dashed border-slate-200 rounded-xl bg-[#F8FAFC]">
              No transactions recorded for this timeframe.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTransactions.map((tx) => (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onSelectBook(tx.bookId, tx.bookSlug)}
                  className="w-full py-3 px-2 -mx-2 rounded-xl hover:bg-[#EAF2FF]/45 transition-colors flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#263445] truncate">
                      {tx.description || 'Untitled transaction'}
                    </p>
                    <p className="text-xs text-[#748197] truncate mt-0.5">
                      {tx.bookName} · {tx.category || 'Other'} · {tx.mode || 'Cash'} ·{' '}
                      {tx.parsedDate.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'text-sm font-mono font-semibold tabular-nums shrink-0',
                      tx.type === 'in' ? 'text-[#21B987]' : 'text-[#F07858]'
                    )}
                  >
                    {formatINR(tx.amount, { type: tx.type })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Cashbook Summary + Highest Expense Categories */}
        <div className="xl:col-span-6 space-y-4 sm:space-y-5">
          {/* Cashbook Summary */}
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#263445]">Cashbook Summary</h3>
                <p className="text-xs text-[#748197]">Totals computed across all fetched ledger entries</p>
              </div>
              <button
                type="button"
                onClick={onNavigateCashbooks}
                className="text-xs font-medium text-[#2866C7] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Open Cashbooks</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {books.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#748197] border border-dashed border-slate-200 rounded-xl bg-[#F8FAFC]">
                No cashbooks yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[#748197]">
                      <th className="py-2 pr-3 font-medium">Cashbook</th>
                      <th className="py-2 px-2 font-medium text-right">Cash In</th>
                      <th className="py-2 px-2 font-medium text-right">Cash Out</th>
                      <th className="py-2 pl-2 font-medium text-right">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {books.slice(0, 6).map((book) => {
                      const scoped = filterAnalyticsTransactions(book.transactions || [], {
                        period,
                        startDate: customStart,
                        endDate: customEnd,
                      });
                      const bTotals = computeLedgerTotals(scoped);
                      const slug = slugifyBookName(book.name, book.id);
                      return (
                        <tr
                          key={book.id}
                          onClick={() => onSelectBook(book.id, slug)}
                          className="hover:bg-[#EAF2FF]/45 transition-colors cursor-pointer"
                        >
                          <td className="py-2.5 pr-3 font-medium text-[#263445] max-w-[160px] truncate">
                            <div>{book.name}</div>
                            <div className="text-[11px] text-[#748197]">{bTotals.count} entries</div>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#21B987]">
                            {formatINR(bTotals.in)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#F07858]">
                            {formatINR(bTotals.out)}
                          </td>
                          <td
                            className={cn(
                              'py-2.5 pl-2 text-right font-mono font-bold tabular-nums',
                              bTotals.net >= 0 ? 'text-[#263445]' : 'text-[#F07858]'
                            )}
                          >
                            {formatINR(bTotals.net, { signed: bTotals.net < 0 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Highest Expense Categories */}
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="mb-4">
              <h3 className="text-sm sm:text-base font-bold text-[#263445]">Highest Expense Categories</h3>
              <p className="text-xs text-[#748197]">Top spending categories for this period</p>
            </div>

            {highestExpenseCategories.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#748197] border border-dashed border-slate-200 rounded-xl bg-[#F8FAFC]">
                No expense categories to rank yet.
              </div>
            ) : (
              <div className="space-y-3">
                {highestExpenseCategories.map((item) => (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#263445]">
                        {item.category}{' '}
                        <span className="text-[#748197] font-normal">({item.count})</span>
                      </span>
                      <span className="font-mono font-semibold text-[#263445] tabular-nums">
                        {formatINR(item.amount)} · {item.percentage}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2866C7]"
                        style={{ width: `${Math.min(100, Math.max(4, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
