import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  CashFlowPoint,
  MonthlyBarPoint,
  CashbookDistributionItem,
  CategoryExpenseItem,
  formatINR,
} from '../../utils/analytics';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  heightClass?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No transaction data in this timeframe yet.',
  heightClass = 'h-72',
  action,
  children,
}: ChartContainerProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-[#263445] truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-[#748197] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {isLoading ? (
        <div className={`${heightClass} w-full rounded-xl bg-slate-100 animate-pulse`} />
      ) : isEmpty ? (
        <div
          className={`${heightClass} w-full rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] flex items-center justify-center px-6 text-center`}
        >
          <p className="text-xs sm:text-sm text-[#748197]">{emptyMessage}</p>
        </div>
      ) : (
        <div className={`${heightClass} w-full min-w-0`}>{children}</div>
      )}
    </section>
  );
}

const formatCompactAxis = (val: number) => {
  const abs = Math.abs(val);
  if (abs >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${Math.round(val)}`;
};

function FinancialTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
      {label && <p className="font-bold text-[#263445] mb-1.5">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry: any) => (
          <div key={entry.dataKey || entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[#748197]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || entry.fill || '#2866C7' }}
              />
              {entry.name}
            </span>
            <span className="font-mono font-semibold text-[#263445] tabular-nums">
              {formatINR(Number(entry.value) || 0, { showDecimals: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CashFlowOverviewChart({
  data,
  isLoading = false,
}: {
  data: CashFlowPoint[];
  isLoading?: boolean;
}) {
  return (
    <ChartCard
      title="Cash Flow Overview"
      subtitle="Cash In, Cash Out, and Net Flow over the selected period"
      isLoading={isLoading}
      isEmpty={data.length === 0}
      emptyMessage="Add Cash In or Cash Out entries to visualize your cash flow trend."
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#748197' }}
            axisLine={{ stroke: '#E2E8F0' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatCompactAxis}
            tick={{ fontSize: 11, fill: '#748197' }}
            axisLine={false}
            tickLine={false}
            width={58}
          />
          <Tooltip content={<FinancialTooltip />} />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
          <Line
            type="monotone"
            dataKey="cashIn"
            name="Cash In"
            stroke="#21B987"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#21B987' }}
            activeDot={{ r: 5 }}
            animationDuration={350}
          />
          <Line
            type="monotone"
            dataKey="cashOut"
            name="Cash Out"
            stroke="#F07858"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#F07858' }}
            activeDot={{ r: 5 }}
            animationDuration={350}
          />
          <Line
            type="monotone"
            dataKey="netFlow"
            name="Net Flow"
            stroke="#2866C7"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 4 }}
            animationDuration={350}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function MonthlyIncomeExpenseChart({
  data,
  isLoading = false,
}: {
  data: MonthlyBarPoint[];
  isLoading?: boolean;
}) {
  return (
    <ChartCard
      title="Monthly Income vs Expense"
      subtitle="Side-by-side Cash In and Cash Out across months"
      isLoading={isLoading}
      isEmpty={data.length === 0}
      emptyMessage="Monthly comparisons will appear once you record transactions."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#748197' }}
            axisLine={{ stroke: '#E2E8F0' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatCompactAxis}
            tick={{ fontSize: 11, fill: '#748197' }}
            axisLine={false}
            tickLine={false}
            width={58}
          />
          <Tooltip content={<FinancialTooltip />} cursor={{ fill: '#EAF2FF', opacity: 0.45 }} />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
          <Bar
            dataKey="cashIn"
            name="Cash In"
            fill="#21B987"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
            animationDuration={350}
          />
          <Bar
            dataKey="cashOut"
            name="Cash Out"
            fill="#F07858"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
            animationDuration={350}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CashbookDistributionChart({
  items,
  mode,
  isLoading = false,
  onSelectBook,
}: {
  items: CashbookDistributionItem[];
  mode: 'net' | 'volume';
  isLoading?: boolean;
  onSelectBook?: (bookId: string, slug: string) => void;
}) {
  const chartData = items.filter((item) => item.shareValue > 0);
  const totalShare = chartData.reduce((acc, i) => acc + i.shareValue, 0);

  return (
    <ChartCard
      title="Cashbook-wise Balance Distribution"
      subtitle={
        mode === 'net'
          ? 'Share of positive net balances across cashbooks'
          : 'Transaction activity volume across cashbooks'
      }
      isLoading={isLoading}
      isEmpty={chartData.length === 0}
      emptyMessage="Create a cashbook and record balances to compare distributions."
    >
      <div className="h-full grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div className="sm:col-span-6 h-48 sm:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="shareValue"
                nameKey="name"
                innerRadius="55%"
                outerRadius="82%"
                paddingAngle={2}
                animationDuration={360}
                onClick={(entry: any) => {
                  if (onSelectBook && entry?.id) {
                    onSelectBook(entry.id, entry.slug);
                  }
                }}
                className={onSelectBook ? 'cursor-pointer' : undefined}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => formatINR(Number(value) || 0, { showDecimals: true })}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="sm:col-span-6 space-y-2 max-h-56 overflow-y-auto pr-1">
          {items.slice(0, 6).map((item) => {
            const pct = totalShare > 0 ? Math.round((item.shareValue / totalShare) * 100) : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectBook?.(item.id, item.slug)}
                className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-xl hover:bg-[#EAF2FF]/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-medium text-[#263445] truncate">
                    {item.name}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-semibold text-[#263445] tabular-nums">
                    {formatINR(item.netBalance, { signed: true })}
                  </div>
                  <div className="text-[10px] text-[#748197] tabular-nums">
                    {pct}% · {item.entryCount} entries
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ChartCard>
  );
}

export function CategoryExpenseChart({
  data,
  isLoading = false,
}: {
  data: CategoryExpenseItem[];
  isLoading?: boolean;
}) {
  return (
    <ChartCard
      title="Category-wise Expense Breakdown"
      subtitle="Top Cash Out spending categories sorted by ₹ spent"
      isLoading={isLoading}
      isEmpty={data.length === 0}
      emptyMessage="No Cash Out expenses recorded in this timeframe."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 18, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={formatCompactAxis}
            tick={{ fontSize: 11, fill: '#748197' }}
            axisLine={{ stroke: '#E2E8F0' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="category"
            width={92}
            tick={{ fontSize: 11, fill: '#263445', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<FinancialTooltip />} cursor={{ fill: '#EAF2FF', opacity: 0.45 }} />
          <Bar
            dataKey="amount"
            name="Spent"
            fill="#2866C7"
            radius={[0, 6, 6, 0]}
            barSize={20}
            animationDuration={350}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
