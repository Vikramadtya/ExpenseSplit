import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Hash, Lightbulb, Minus } from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { BudgetsPanel } from '../features/budgets/BudgetsPanel';
import { categoryStyle, useCategories } from '../features/categories/useCategories';
import { getAnalyticsOptions } from '../api/@tanstack/react-query.gen';
import { formatCurrency } from '../utils/currency';

type Period = 'month' | '30d' | 'year' | 'all';

const PERIODS: Array<{ id: Period; label: string; groupBy: 'day' | 'week' | 'month' }> = [
  { id: 'month', label: 'This month', groupBy: 'day' },
  { id: '30d', label: 'Last 30 days', groupBy: 'day' },
  { id: 'year', label: 'This year', groupBy: 'month' },
  { id: 'all', label: 'All time', groupBy: 'month' },
];

const periodStart = (period: Period): string | undefined => {
  const now = new Date();
  if (period === 'month')
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  if (period === 'year') return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  if (period === '30d') return new Date(now.getTime() - 30 * 86_400_000).toISOString();
  return undefined;
};

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const Card = ({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="glass-panel p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-base font-semibold text-text-main">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

function Change({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null;
  const up = value > 0;
  const Icon = value === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  // Spending going up is the "bad" direction, so it is the warm colour.
  const tone = value === 0 ? 'text-text-muted' : up ? 'text-amber-600' : 'text-emerald-600';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value)}% vs before
    </span>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
  return (
    <div className="glass-panel p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-text-main">
        {value}
      </p>
      <div className="mt-1 min-h-[1rem]">{note}</div>
    </div>
  );
}

export default function AnalyticsPage({ workspaceId }: { workspaceId: string }) {
  const { roots, childrenOf, iconOf } = useCategories(workspaceId);
  const [period, setPeriod] = useState<Period>('month');
  const [currency, setCurrency] = useState<string | null>(null);
  const [basis, setBasis] = useState<'mine' | 'group'>('mine');
  const groupBy = PERIODS.find((p) => p.id === period)?.groupBy ?? 'day';

  const { data, isLoading } = useQuery({
    ...getAnalyticsOptions({
      path: { workspaceId },
      query: { from: periodStart(period), groupBy },
    }),
    // Keep the old numbers on screen while a new period loads, so nothing flashes.
    placeholderData: (previous) => previous,
  });

  const all = data?.byCurrency ?? [];
  const stat = all.find((s) => s.currency === currency) ?? all[0];

  /** Categories rolled up under their parent, biggest first, each with its sub-categories. */
  const breakdown = useMemo(() => {
    if (!stat) return [];
    const totals = new Map<string, number>(
      basis === 'mine'
        ? (stat.yourShareByCategory ?? []).map((c) => [c.category, c.total])
        : (stat.topCategories ?? []).map((c) => [c.description, c.total]),
    );
    const known = new Set<string>();
    const rows = roots.map((root) => {
      const kids = childrenOf(root.id)
        .map((k) => ({ name: k.name, total: totals.get(k.name) ?? 0 }))
        .filter((k) => k.total > 0)
        .sort((a, b) => b.total - a.total);
      known.add(root.name);
      kids.forEach((k) => known.add(k.name));
      return {
        name: root.name,
        total: (totals.get(root.name) ?? 0) + kids.reduce((sum, k) => sum + k.total, 0),
        kids,
      };
    });
    // Anything not in the tree (renamed or imported) still shows up, on its own.
    for (const [name, total] of totals) if (!known.has(name)) rows.push({ name, total, kids: [] });
    return rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  }, [stat, basis, roots, childrenOf]);

  if (isLoading && !data) {
    return (
      <DashboardLayout>
        <PageSkeleton rows={3} />
      </DashboardLayout>
    );
  }

  const insights: string[] = [];
  if (stat) {
    const top = breakdown[0];
    const base = breakdown.reduce((sum, r) => sum + r.total, 0);
    if (top && base > 0) {
      insights.push(
        `${top.name} is ${basis === 'mine' ? 'where most of your money goes' : "the group's biggest category"}: ${percent(top.total, base)}% of ${basis === 'mine' ? 'your share' : 'spending'}.`,
      );
    }
    const big = stat.biggestExpenses?.[0];
    if (big) {
      insights.push(
        `The biggest expense was “${big.description}” at ${formatCurrency(big.amount, stat.currency)}.`,
      );
    }
    const days = Math.max(stat.spendOverTime?.length ?? 0, 1);
    if (groupBy === 'day' && stat.expenseCount > 0) {
      insights.push(
        `That is about ${formatCurrency(stat.totalSpend / days, stat.currency)} on a typical active day.`,
      );
    }
    if (stat.changeVsPrevious !== null && stat.changeVsPrevious !== undefined) {
      insights.push(
        `Spending is ${stat.changeVsPrevious > 0 ? 'up' : stat.changeVsPrevious < 0 ? 'down' : 'flat'}${stat.changeVsPrevious ? ` ${Math.abs(stat.changeVsPrevious)}%` : ''} compared with the period before.`,
      );
    }
  }

  const tick = (v: string) =>
    new Date(`${v}T12:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      ...(groupBy === 'month' ? { year: '2-digit' } : { day: 'numeric' }),
    });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-main">Analytics</h1>
            <p className="mt-1 text-sm text-text-muted">
              Where the money goes, and how it changes.
            </p>
          </div>
          <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={`press whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${period === p.id ? 'bg-background text-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {all.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {all.map((s) => (
              <button
                key={s.currency}
                type="button"
                onClick={() => setCurrency(s.currency)}
                className={`press rounded-full border px-3 py-1 text-sm font-medium ${stat?.currency === s.currency ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:text-text-main'}`}
              >
                {s.currency}
              </button>
            ))}
          </div>
        )}

        {!stat ? (
          <div className="glass-panel p-12 text-center">
            <p className="font-medium text-text-main">Nothing to show for this period</p>
            <p className="mt-1 text-sm text-text-muted">Add an expense or pick a longer period.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat
                label="Your share"
                value={formatCurrency(stat.trueSpending ?? 0, stat.currency)}
                note={<span className="text-xs text-text-muted">What you actually owe for</span>}
              />
              <Stat
                label="Group total"
                value={formatCurrency(stat.totalSpend, stat.currency)}
                note={<Change value={stat.changeVsPrevious} />}
              />
              <Stat
                label="Average expense"
                value={formatCurrency(stat.averageExpense ?? 0, stat.currency)}
                note={<span className="text-xs text-text-muted">per expense</span>}
              />
              <Stat
                label="Expenses"
                value={String(stat.expenseCount)}
                note={
                  <span className="text-xs text-text-muted">
                    you paid {formatCurrency(stat.cashOut ?? 0, stat.currency)}
                  </span>
                }
              />
            </div>

            {insights.length > 0 && (
              <div className="glass-panel flex gap-3 p-5">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <ul className="space-y-1.5 text-sm text-text-main">
                  {insights.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            <Card title="Spending over time">
              {stat.spendOverTime.length === 0 ? (
                <p className="py-10 text-center text-sm text-text-muted">
                  No spending in this period.
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stat.spendOverTime}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={tick}
                        tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={24}
                      />
                      <YAxis
                        tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                        tickFormatter={(v: number) =>
                          v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v)
                        }
                      />
                      <Tooltip
                        formatter={(v) => [formatCurrency(Number(v), stat.currency), 'Spent']}
                        labelFormatter={(l) => tick(String(l))}
                        contentStyle={{
                          background: 'var(--background)',
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        fill="url(#spendFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <Card
                  title="By category"
                  aside={
                    <div role="tablist" className="flex gap-1 rounded-lg bg-surface p-0.5 text-xs">
                      {(['mine', 'group'] as const).map((b) => (
                        <button
                          key={b}
                          type="button"
                          role="tab"
                          aria-selected={basis === b}
                          onClick={() => setBasis(b)}
                          className={`rounded-md px-2.5 py-1 font-medium ${basis === b ? 'bg-background text-primary shadow-sm' : 'text-text-muted'}`}
                        >
                          {b === 'mine' ? 'Your share' : 'Group'}
                        </button>
                      ))}
                    </div>
                  }
                >
                  {breakdown.length === 0 ? (
                    <p className="py-6 text-center text-sm text-text-muted">No categories yet.</p>
                  ) : (
                    <ul className="space-y-4">
                      {breakdown.map((row) => {
                        const base = breakdown.reduce((sum, r) => sum + r.total, 0);
                        return (
                          <li key={row.name}>
                            <div className="flex items-center gap-3">
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
                                style={categoryStyle(row.name)}
                              >
                                {iconOf(row.name)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="truncate text-sm font-medium text-text-main">
                                    {row.name}
                                  </span>
                                  <span className="text-sm tabular-nums text-text-main">
                                    {formatCurrency(row.total, stat.currency)}
                                    <span className="ml-1.5 text-xs text-text-muted">
                                      {percent(row.total, base)}%
                                    </span>
                                  </span>
                                </div>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border/60">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${percent(row.total, base)}%`,
                                      backgroundColor: categoryStyle(row.name).color,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            {row.kids.length > 0 && (
                              <ul className="ml-12 mt-2 space-y-1">
                                {row.kids.map((kid) => (
                                  <li
                                    key={kid.name}
                                    className="flex justify-between text-xs text-text-muted"
                                  >
                                    <span>
                                      {iconOf(kid.name)} {kid.name}
                                    </span>
                                    <span className="tabular-nums">
                                      {formatCurrency(kid.total, stat.currency)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </div>

              <div className="space-y-6 lg:col-span-2">
                <Card title="Who the spending is for">
                  <ul className="space-y-3">
                    {stat.spendByMember.map((m) => (
                      <li key={m.userId} className="flex items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                          style={categoryStyle(m.name)}
                        >
                          {initials(m.name)}
                        </span>
                        <span className="flex-1 truncate text-sm text-text-main">{m.name}</span>
                        <span className="text-sm tabular-nums text-text-main">
                          {formatCurrency(m.amount, stat.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card title="Biggest expenses">
                  {(stat.biggestExpenses ?? []).length === 0 ? (
                    <p className="text-sm text-text-muted">None yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {stat.biggestExpenses?.map((e) => (
                        <li key={e.id} className="flex items-center gap-3">
                          <span className="text-lg">{iconOf(e.category)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text-main">
                              {e.description}
                            </p>
                            <p className="text-xs text-text-muted">{tick(e.date)}</p>
                          </div>
                          <span className="text-sm tabular-nums text-text-main">
                            {formatCurrency(e.amount, stat.currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>

            {(stat.tagsAnalysis ?? []).length > 0 && (
              <Card title="Top tags">
                <div className="flex flex-wrap gap-2">
                  {stat.tagsAnalysis?.slice(0, 12).map((t) => (
                    <span
                      key={t.tag}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                    >
                      <Hash className="h-3.5 w-3.5" />
                      {t.tag}
                      <span className="text-primary/70">
                        · {formatCurrency(t.total ?? 0, stat.currency)}
                      </span>
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        <BudgetsPanel workspaceId={workspaceId} />
      </div>
    </DashboardLayout>
  );
}
