import React, { useMemo, useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Filter,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  TimePeriodFilter,
  AnalyticsBook,
  AnalyticsTransaction,
  flattenBooksTransactions,
  filterAnalyticsTransactions,
  computeLedgerTotals,
  buildCashFlowSeries,
  buildMonthlyIncomeExpenseSeries,
  buildCategoryExpenseBreakdown,
  buildPaymentModeSummary,
  formatINR,
} from '../utils/analytics';
import {
  CashFlowOverviewChart,
  MonthlyIncomeExpenseChart,
  CategoryExpenseChart,
} from '../components/charts/DashboardCharts';

interface ReportsViewProps {
  books: AnalyticsBook[];
  isLoading: boolean;
  onExportPdf: (bookId: string, bookName: string, transactions: AnalyticsTransaction[]) => void;
  onExportExcel: (bookId: string, bookName: string, transactions: AnalyticsTransaction[]) => void;
}

const PERIOD_OPTIONS: Array<{ id: TimePeriodFilter; label: string }> = [
  { id: 'all', label: 'All Time' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom' },
];

export default function ReportsView({
  books,
  isLoading,
  onExportPdf,
  onExportExcel,
}: ReportsViewProps) {
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [period, setPeriod] = useState<TimePeriodFilter>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [txType, setTxType] = useState<'all' | 'in' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const scopedSourceTransactions = useMemo(() => {
    if (selectedBookId === 'all') {
      return flattenBooksTransactions(books);
    }
    const book = books.find((b) => b.id === selectedBookId);
    if (!book) return [];
    return flattenBooksTransactions([book]);
  }, [books, selectedBookId]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    scopedSourceTransactions.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [scopedSourceTransactions]);

  const filteredTransactions = useMemo(
    () =>
      filterAnalyticsTransactions(scopedSourceTransactions, {
        period,
        startDate: customStart,
        endDate: customEnd,
        type: txType,
        category: categoryFilter,
      }),
    [scopedSourceTransactions, period, customStart, customEnd, txType, categoryFilter]
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
  const categoryExpenses = useMemo(
    () => buildCategoryExpenseBreakdown(filteredTransactions, 10),
    [filteredTransactions]
  );
  const paymentModeSummary = useMemo(
    () => buildPaymentModeSummary(filteredTransactions),
    [filteredTransactions]
  );

  const selectedBookName = useMemo(() => {
    if (selectedBookId === 'all') return 'All Cashbooks Report';
    return books.find((b) => b.id === selectedBookId)?.name || 'Cashbook Report';
  }, [books, selectedBookId]);

  const resetFilters = () => {
    setSelectedBookId('all');
    setPeriod('all');
    setCustomStart('');
    setCustomEnd('');
    setTxType('all');
    setCategoryFilter('All');
  };

  return (
    <div className="space-y-6">
      {/* Filter & Export Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#263445] tracking-tight">Financial Reports</h2>
            <p className="text-xs text-[#748197] mt-0.5">
              Analyze income, expenses, categories, and payment modes across your ledgers
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={filteredTransactions.length === 0}
              onClick={() => onExportExcel(selectedBookId, selectedBookName, filteredTransactions)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-medium text-[#263445] transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet size={16} className="text-[#21B987]" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              disabled={filteredTransactions.length === 0}
              onClick={() => onExportPdf(selectedBookId, selectedBookName, filteredTransactions)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2866C7] hover:bg-[#2058A8] text-white text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
            >
              <FileText size={16} />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[#748197] mb-1">Cashbook</label>
            <select
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-[#263445] outline-none focus:border-[#2866C7]"
            >
              <option value="all">All Cashbooks ({books.length})</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#748197] mb-1">Transaction Type</label>
            <select
              value={txType}
              onChange={(e) => setTxType(e.target.value as 'all' | 'in' | 'out')}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-[#263445] outline-none focus:border-[#2866C7]"
            >
              <option value="all">All Entries</option>
              <option value="in">Cash In Only</option>
              <option value="out">Cash Out Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#748197] mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-[#263445] outline-none focus:border-[#2866C7]"
            >
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-[#F1F5F9] hover:bg-[#EAF2FF] text-xs font-medium text-[#263445] transition-colors"
            >
              <RotateCcw size={14} />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>

        {/* Date Presets */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-[#748197] mr-1">
              <Filter size={13} /> Period:
            </span>
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                  period === opt.id
                    ? 'bg-[#2866C7] text-white'
                    : 'bg-[#F1F5F9] text-[#748197] hover:bg-[#EAF2FF] hover:text-[#2866C7]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#263445]"
              />
              <span className="text-[#748197]">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#263445]"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#748197]">Filtered Cash In</p>
            <p className="text-xl font-bold font-mono tabular-nums text-[#21B987] mt-1">
              {formatINR(totals.in)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#21B987] flex items-center justify-center">
            <ArrowUpRight size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#748197]">Filtered Cash Out</p>
            <p className="text-xl font-bold font-mono tabular-nums text-[#F07858] mt-1">
              {formatINR(totals.out)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F07858] flex items-center justify-center">
            <ArrowDownRight size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#748197]">Net Balance ({totals.count} entries)</p>
            <p
              className={cn(
                'text-xl font-bold font-mono tabular-nums mt-1',
                totals.net >= 0 ? 'text-[#2866C7]' : 'text-[#F07858]'
              )}
            >
              {formatINR(totals.net, { signed: totals.net < 0 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#2866C7] flex items-center justify-center">
            <Wallet size={20} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        <CashFlowOverviewChart data={cashFlowSeries} isLoading={isLoading} />
        <MonthlyIncomeExpenseChart data={monthlySeries} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        <CategoryExpenseChart data={categoryExpenses} isLoading={isLoading} />

        {/* Payment Mode Summary Table */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-sm sm:text-base font-bold text-[#263445]">Payment Mode Summary</h3>
            <p className="text-xs text-[#748197]">Cash In and Cash Out totals grouped by payment mode</p>
          </div>

          {paymentModeSummary.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#748197] border border-dashed border-slate-200 rounded-xl bg-[#F8FAFC]">
              No matching entries for payment mode breakdown.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[#748197]">
                    <th className="py-2 pr-3 font-medium">Mode</th>
                    <th className="py-2 px-2 font-medium text-right">Entries</th>
                    <th className="py-2 px-2 font-medium text-right">Cash In</th>
                    <th className="py-2 pl-2 font-medium text-right">Cash Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentModeSummary.map((item) => (
                    <tr key={item.mode}>
                      <td className="py-2.5 pr-3 font-medium text-[#263445]">{item.mode}</td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#748197]">
                        {item.count}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#21B987]">
                        {formatINR(item.cashIn)}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono tabular-nums text-[#F07858]">
                        {formatINR(item.cashOut)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
