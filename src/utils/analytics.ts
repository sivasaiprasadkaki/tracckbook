export type TimePeriodFilter = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'all';

export interface AnalyticsTransaction {
  id: string;
  amount: number;
  type: 'in' | 'out';
  description: string;
  category: string;
  mode: string;
  date: Date | string;
  images?: string[];
  source?: string;
}

export interface AnalyticsBook {
  id: string;
  name: string;
  createdAt?: Date | string;
  transactions: AnalyticsTransaction[];
}

export interface FlattenedTransaction extends AnalyticsTransaction {
  parsedDate: Date;
  bookId: string;
  bookName: string;
  bookSlug: string;
}

export function slugifyBookName(name: string, id: string): string {
  const slug = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || id;
}

export function toValidDate(input: Date | string | number | undefined | null): Date {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? new Date() : input;
  }
  if (input !== undefined && input !== null) {
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function formatINR(
  amount: number,
  options?: { showDecimals?: boolean; signed?: boolean; type?: 'in' | 'out' }
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const showDecimals = options?.showDecimals ?? false;

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 2,
  }).format(abs);

  if (options?.type === 'in') return `+${formatted}`;
  if (options?.type === 'out') return `-${formatted}`;
  if (options?.signed) {
    if (safe > 0) return `+${formatted}`;
    if (safe < 0) return `-${formatted}`;
  }
  return safe < 0 ? `-${formatted}` : formatted;
}

export function getDateRangeForPeriod(
  period: TimePeriodFilter,
  customStart?: string,
  customEnd?: string,
  nowRef: Date = new Date()
): { start: Date | null; end: Date | null } {
  const now = new Date(nowRef);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (period === 'all') {
    return { start: null, end: null };
  }
  if (period === 'daily') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { start: startOfToday, end: endOfToday };
  }
  if (period === 'weekly') {
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    return { start: startOfWeek, end: endOfToday };
  }
  if (period === 'monthly') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { start: startOfMonth, end: endOfToday };
  }
  if (period === 'yearly') {
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { start: startOfYear, end: endOfToday };
  }

  // Custom range
  let start: Date | null = null;
  let end: Date | null = null;
  if (customStart) {
    const [y, m, d] = customStart.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      start = new Date(y, m - 1, d, 0, 0, 0, 0);
    }
  }
  if (customEnd) {
    const [y, m, d] = customEnd.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      end = new Date(y, m - 1, d, 23, 59, 59, 999);
    }
  }
  return { start, end };
}

export function flattenBooksTransactions(books: AnalyticsBook[]): FlattenedTransaction[] {
  const result: FlattenedTransaction[] = [];
  const seenIds = new Set<string>();

  for (const book of books) {
    const slug = slugifyBookName(book.name, book.id);
    const list = Array.isArray(book.transactions) ? book.transactions : [];
    for (const tx of list) {
      if (!tx || !tx.id) continue;
      if (seenIds.has(tx.id)) continue;
      seenIds.add(tx.id);
      const parsedDate = toValidDate(tx.date);
      result.push({
        ...tx,
        amount: Number(tx.amount) || 0,
        parsedDate,
        bookId: book.id,
        bookName: book.name,
        bookSlug: slug,
      });
    }
  }

  result.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
  return result;
}

export function filterAnalyticsTransactions<T extends AnalyticsTransaction>(
  transactions: T[],
  options: {
    period: TimePeriodFilter;
    startDate?: string;
    endDate?: string;
    type?: 'all' | 'in' | 'out';
    category?: string;
    mode?: string;
    search?: string;
  }
): T[] {
  const { start, end } = getDateRangeForPeriod(options.period, options.startDate, options.endDate);
  const searchLower = (options.search || '').trim().toLowerCase();

  return transactions.filter((tx) => {
    const dt = toValidDate(tx.date);
    if (start && dt < start) return false;
    if (end && dt > end) return false;
    if (options.type && options.type !== 'all' && tx.type !== options.type) return false;
    if (options.category && options.category !== 'All' && (tx.category || 'Other') !== options.category) return false;
    if (options.mode && options.mode !== 'All' && (tx.mode || 'Cash') !== options.mode) return false;
    if (searchLower) {
      const matchesDesc = (tx.description || '').toLowerCase().includes(searchLower);
      const matchesCat = (tx.category || '').toLowerCase().includes(searchLower);
      const matchesMode = (tx.mode || '').toLowerCase().includes(searchLower);
      const matchesAmount = String(tx.amount || '').includes(searchLower);
      if (!matchesDesc && !matchesCat && !matchesMode && !matchesAmount) return false;
    }
    return true;
  });
}

export function computeLedgerTotals(transactions: AnalyticsTransaction[]): {
  in: number;
  out: number;
  net: number;
  count: number;
} {
  let cashIn = 0;
  let cashOut = 0;

  for (const tx of transactions) {
    const val = Number(tx.amount) || 0;
    if (tx.type === 'in') cashIn += val;
    else if (tx.type === 'out') cashOut += val;
  }

  return {
    in: cashIn,
    out: cashOut,
    net: cashIn - cashOut,
    count: transactions.length,
  };
}

export interface CashFlowPoint {
  label: string;
  sortKey: string;
  cashIn: number;
  cashOut: number;
  netFlow: number;
}

export function buildCashFlowSeries(
  transactions: AnalyticsTransaction[],
  period: TimePeriodFilter
): CashFlowPoint[] {
  if (transactions.length === 0) return [];

  const buckets = new Map<string, { label: string; sortKey: string; cashIn: number; cashOut: number }>();

  const useHourly = period === 'daily';
  const useMonthly = period === 'yearly' || period === 'all';

  for (const tx of transactions) {
    const d = toValidDate(tx.date);
    let sortKey: string;
    let label: string;

    if (useHourly) {
      const hour = d.getHours();
      const padH = String(hour).padStart(2, '0');
      sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${padH}`;
      const suffix = hour >= 12 ? 'PM' : 'AM';
      const displayH = hour % 12 === 0 ? 12 : hour % 12;
      label = `${displayH} ${suffix}`;
    } else if (useMonthly) {
      const m = String(d.getMonth() + 1).padStart(2, '0');
      sortKey = `${d.getFullYear()}-${m}`;
      label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    } else {
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      sortKey = `${d.getFullYear()}-${m}-${day}`;
      label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }

    const bucket = buckets.get(sortKey) || { label, sortKey, cashIn: 0, cashOut: 0 };
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'in') bucket.cashIn += amt;
    else bucket.cashOut += amt;
    buckets.set(sortKey, bucket);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((b) => ({
      ...b,
      netFlow: b.cashIn - b.cashOut,
    }));
}

export interface MonthlyBarPoint {
  month: string;
  sortKey: string;
  cashIn: number;
  cashOut: number;
  net: number;
}

export function buildMonthlyIncomeExpenseSeries(
  transactions: AnalyticsTransaction[],
  monthsLimit: number = 12
): MonthlyBarPoint[] {
  if (transactions.length === 0) return [];

  const buckets = new Map<string, MonthlyBarPoint>();
  for (const tx of transactions) {
    const d = toValidDate(tx.date);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const sortKey = `${d.getFullYear()}-${m}`;
    const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

    const existing = buckets.get(sortKey) || {
      month: monthLabel,
      sortKey,
      cashIn: 0,
      cashOut: 0,
      net: 0,
    };
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'in') existing.cashIn += amt;
    else existing.cashOut += amt;
    existing.net = existing.cashIn - existing.cashOut;
    buckets.set(sortKey, existing);
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return sorted.slice(-monthsLimit);
}

const CHART_SERIES_COLORS = [
  '#2866C7',
  '#21B987',
  '#3B82F6',
  '#0EA5E9',
  '#F59E0B',
  '#F07858',
  '#14B8A6',
  '#64748B',
];

export interface CashbookDistributionItem {
  id: string;
  name: string;
  slug: string;
  cashIn: number;
  cashOut: number;
  netBalance: number;
  shareValue: number;
  entryCount: number;
  color: string;
}

export function buildCashbookDistribution(
  books: AnalyticsBook[],
  period: TimePeriodFilter,
  startDate?: string,
  endDate?: string
): { items: CashbookDistributionItem[]; mode: 'net' | 'volume' } {
  const raw = books.map((book, index) => {
    const filtered = filterAnalyticsTransactions(book.transactions || [], {
      period,
      startDate,
      endDate,
    });
    const totals = computeLedgerTotals(filtered);
    return {
      id: book.id,
      name: book.name,
      slug: slugifyBookName(book.name, book.id),
      cashIn: totals.in,
      cashOut: totals.out,
      netBalance: totals.net,
      entryCount: totals.count,
      color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
    };
  });

  const positiveNetSum = raw.reduce((acc, b) => acc + Math.max(0, b.netBalance), 0);
  const mode: 'net' | 'volume' = positiveNetSum > 0 ? 'net' : 'volume';

  const items: CashbookDistributionItem[] = raw
    .map((b) => ({
      ...b,
      shareValue: mode === 'net' ? Math.max(0, b.netBalance) : b.cashIn + b.cashOut,
    }))
    .filter((b) => b.shareValue > 0 || b.entryCount > 0)
    .sort((a, b) => b.shareValue - a.shareValue || b.entryCount - a.entryCount);

  return { items, mode };
}

export interface CategoryExpenseItem {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export function buildCategoryExpenseBreakdown(
  transactions: AnalyticsTransaction[],
  limit: number = 8
): CategoryExpenseItem[] {
  const expenses = transactions.filter((t) => t.type === 'out');
  if (expenses.length === 0) return [];

  const map = new Map<string, { amount: number; count: number }>();
  let totalOut = 0;

  for (const tx of expenses) {
    const cat = (tx.category || 'Uncategorized').trim() || 'Uncategorized';
    const amt = Number(tx.amount) || 0;
    totalOut += amt;
    const prev = map.get(cat) || { amount: 0, count: 0 };
    map.set(cat, { amount: prev.amount + amt, count: prev.count + 1 });
  }

  return Array.from(map.entries())
    .map(([category, stats]) => ({
      category,
      amount: stats.amount,
      count: stats.count,
      percentage: totalOut > 0 ? Math.round((stats.amount / totalOut) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export interface PaymentModeSummaryItem {
  mode: string;
  cashIn: number;
  cashOut: number;
  total: number;
  count: number;
}

export function buildPaymentModeSummary(
  transactions: AnalyticsTransaction[]
): PaymentModeSummaryItem[] {
  if (transactions.length === 0) return [];
  const map = new Map<string, PaymentModeSummaryItem>();

  for (const tx of transactions) {
    const modeName = (tx.mode || 'Cash').trim() || 'Cash';
    const amt = Number(tx.amount) || 0;
    const prev = map.get(modeName) || {
      mode: modeName,
      cashIn: 0,
      cashOut: 0,
      total: 0,
      count: 0,
    };
    if (tx.type === 'in') prev.cashIn += amt;
    else prev.cashOut += amt;
    prev.total += amt;
    prev.count += 1;
    map.set(modeName, prev);
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function getRecentTransactions(
  flattened: FlattenedTransaction[],
  limit: number = 10
): FlattenedTransaction[] {
  return [...flattened]
    .sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime())
    .slice(0, limit);
}
