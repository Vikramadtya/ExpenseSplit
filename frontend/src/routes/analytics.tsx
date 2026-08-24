import DashboardLayout from '../layouts/DashboardLayout';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../utils/currency';
import { getAnalyticsOptions } from '../api/@tanstack/react-query.gen';

const CATEGORY_ICONS: Record<string, string> = {
  'Food & Drink': '🍽️',
  Transport: '🚗',
  Shopping: '🛍️',
  Entertainment: '🎬',
  Accommodation: '🏠',
  Utilities: '💡',
  Groceries: '🛒',
  Other: '📝',
};

export default function AnalyticsPage({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useQuery(getAnalyticsOptions({ path: { workspaceId } }));

  if (isLoading)
    return (
      <DashboardLayout>
        <div className="p-6 animate-pulse space-y-4">Loading analytics...</div>
      </DashboardLayout>
    );

  const byCurrency = data?.byCurrency || [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Advanced Analytics</h1>

        {byCurrency.length === 0 && <p className="text-zinc-500">No data available.</p>}

        {byCurrency.map((stat: any) => {
          const {
            currency,
            totalSpend,
            spendOverTime,
            topCategories,
            trueSpending,
            cashOut,
            received,
            paid,
            todaySpend,
            thisMonthSpend,
            tagsAnalysis,
          } = stat;

          return (
            <div
              key={currency}
              className="mb-12 border-t border-zinc-200 dark:border-zinc-800 pt-8 first:border-0 first:pt-0"
            >
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6 uppercase tracking-wider">
                {currency}
              </h2>

              {/* Financial Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                  <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    True Spending
                  </p>
                  <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mt-1">
                    {formatCurrency(trueSpending || 0, currency)}
                  </p>
                  <p className="text-xs text-indigo-500 mt-1">Your actual share of expenses</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Cash Out
                  </p>
                  <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                    {formatCurrency(cashOut || 0, currency)}
                  </p>
                  <p className="text-xs text-emerald-500 mt-1">Paid from your pocket</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800/50">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Received (Settled)
                  </p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                    {formatCurrency(received || 0, currency)}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">Cash returned to you</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-xl border border-orange-100 dark:border-orange-800/50">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    Paid (Settled)
                  </p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">
                    {formatCurrency(paid || 0, currency)}
                  </p>
                  <p className="text-xs text-orange-500 mt-1">You paid others back</p>
                </div>
              </div>

              {/* Time stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-surface p-6 rounded-xl shadow-sm border border-border">
                  <p className="text-sm font-medium text-text-muted">Today's Spend</p>
                  <p className="text-3xl font-bold text-text-main mt-2">
                    {formatCurrency(todaySpend || 0, currency)}
                  </p>
                </div>
                <div className="bg-surface p-6 rounded-xl shadow-sm border border-border">
                  <p className="text-sm font-medium text-text-muted">This Month's Spend</p>
                  <p className="text-3xl font-bold text-text-main mt-2">
                    {formatCurrency(thisMonthSpend || 0, currency)}
                  </p>
                </div>
                <div className="bg-surface p-6 rounded-xl shadow-sm border border-border">
                  <p className="text-sm font-medium text-text-muted">Workspace Total Spend</p>
                  <p className="text-3xl font-bold text-text-main mt-2">
                    {formatCurrency(totalSpend, currency)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Spend Over Time */}
                <div className="bg-surface p-6 rounded-xl shadow-sm border border-border">
                  <h2 className="text-lg font-semibold text-text-main mb-4">Spend Over Time</h2>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={spendOverTime}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id={`colorAmount-${currency}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e5e7eb"
                          className="dark:stroke-zinc-800"
                        />
                        <XAxis
                          dataKey="date"
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => formatCurrency(value, currency)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="amount"
                          stroke="#8b5cf6"
                          fillOpacity={1}
                          fill={`url(#colorAmount-${currency})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Categories */}
                <div className="bg-surface p-6 rounded-xl shadow-sm border border-border">
                  <h2 className="text-lg font-semibold text-text-main mb-4">Categories & Tags</h2>

                  <div className="space-y-4 mb-6">
                    <h3 className="text-sm font-medium text-text-muted">Top Categories</h3>
                    {topCategories?.map((cat: any, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{CATEGORY_ICONS[cat.description] || '📝'}</span>
                          <span className="text-sm font-medium text-text-main">
                            {cat.description}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-text-main">
                          {formatCurrency(cat.total, currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {tagsAnalysis && tagsAnalysis.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-border">
                      <h3 className="text-sm font-medium text-text-muted">Top Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {tagsAnalysis.map((tag: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium border border-indigo-100 dark:border-indigo-800"
                          >
                            #{tag.tag}
                            <span className="opacity-60">
                              {formatCurrency(tag.total, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
