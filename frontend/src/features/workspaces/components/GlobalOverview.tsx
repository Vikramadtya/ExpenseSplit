import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '../../../utils/currency';

interface GlobalOverviewProps {
  isLoading?: boolean;
  analytics: any;
  balances: any;
  selectedCurrency: string;
  setSelectedCurrency: (curr: string) => void;
}

export function GlobalOverview({
  isLoading,
  analytics,
  balances,
  selectedCurrency,
  setSelectedCurrency,
}: GlobalOverviewProps) {
  const activeBalance =
    balances?.byCurrency?.find((c: any) => c.currency === selectedCurrency) ||
    balances?.byCurrency?.[0];
  const activeAnalytics = analytics?.byCurrency?.find(
    (c: any) => c.currency === (activeBalance?.currency || 'USD'),
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold font-display text-text-main flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          Global Overview
        </h2>
        {balances?.byCurrency && balances.byCurrency.length > 1 && (
          <select
            value={selectedCurrency || activeBalance?.currency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="input-field max-w-[120px] text-sm py-1.5"
          >
            {balances.byCurrency.map((b: any) => (
              <option key={b.currency} value={b.currency}>
                {b.currency}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="h-48 bg-surface rounded-xl border border-border"></div>
          <div className="h-64 bg-surface rounded-xl border border-border"></div>
        </div>
      ) : !activeBalance ? (
        <div className="glass-panel p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
            <BarChart2 className="w-8 h-8 text-text-muted opacity-50" />
          </div>
          <p className="text-lg font-medium text-text-main">No global data yet</p>
          <p className="text-sm text-text-muted mt-1 max-w-sm mx-auto">
            Create a workspace and add some expenses to see your global overview.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-panel p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <BarChart2 className="w-16 h-16" />
              </div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
                Total Spent
              </p>
              <p className="text-2xl font-display font-bold text-text-main">
                {formatCurrency(activeAnalytics?.totalSpend || 0, activeBalance.currency)}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="text-text-muted">
                  {activeAnalytics?.expenseCount || 0} expenses
                </span>
              </div>
            </div>

            <div className="glass-panel p-5 relative overflow-hidden group">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
                You Owe
              </p>
              <p className="text-2xl font-display font-bold text-orange-500">
                {formatCurrency(activeBalance.youOwe || 0, activeBalance.currency)}
              </p>
            </div>

            <div className="glass-panel p-5 relative overflow-hidden group">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
                Owed to You
              </p>
              <p className="text-2xl font-display font-bold text-emerald-500">
                {formatCurrency(activeBalance.owedToYou || 0, activeBalance.currency)}
              </p>
            </div>

            <div className="glass-panel p-5 relative overflow-hidden group bg-primary/5 border-primary/20">
              <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">
                Net Balance
              </p>
              <p
                className={`text-2xl font-display font-bold ${activeBalance.total > 0 ? 'text-emerald-500' : activeBalance.total < 0 ? 'text-orange-500' : 'text-text-main'}`}
              >
                {activeBalance.total > 0 ? '+' : ''}
                {formatCurrency(activeBalance.total || 0, activeBalance.currency)}
              </p>
            </div>
          </div>

          {/* Spend Over Time Graph */}
          {activeAnalytics &&
            activeAnalytics.spendOverTime &&
            activeAnalytics.spendOverTime.length > 0 && (
              <div className="glass-panel p-6">
                <h3 className="font-display font-semibold mb-6">Spend Over Time</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={activeAnalytics.spendOverTime}
                      margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id={`colorAmount-${activeBalance.currency}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="currentColor"
                        className="opacity-10"
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }}
                        tickFormatter={(val) =>
                          `${getCurrencySymbol(activeBalance.currency)}${val}`
                        }
                        dx={-10}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                        itemStyle={{ color: 'var(--text-main)' }}
                        formatter={(value: any) =>
                          formatCurrency(value as number, activeBalance.currency)
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#4f46e5"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill={`url(#colorAmount-${activeBalance.currency})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

          {/* Category Breakdown Graph */}
          {activeAnalytics &&
            activeAnalytics.topCategories &&
            activeAnalytics.topCategories.length > 0 && (
              <div className="glass-panel p-6">
                <h3 className="font-display font-semibold mb-6">Top Categories</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={activeAnalytics.topCategories}
                      layout="vertical"
                      margin={{ left: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={true}
                        vertical={false}
                        stroke="currentColor"
                        className="opacity-10"
                      />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="description"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }}
                      />
                      <Tooltip
                        cursor={{ fill: 'var(--border)', opacity: 0.4 }}
                        contentStyle={{
                          backgroundColor: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                        }}
                        formatter={(value: any) =>
                          formatCurrency(value as number, activeBalance.currency)
                        }
                      />
                      <Bar dataKey="total" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
