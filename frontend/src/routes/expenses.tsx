import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '../layouts/DashboardLayout';
import {
  listWorkspaceExpensesOptions,
  getWorkspaceMembersOptions,
  deleteExpenseMutation,
} from '../api/@tanstack/react-query.gen';
import { formatCurrency } from '../utils/currency';
import { Search, Filter, ArrowUpDown, Pencil, Trash2 } from 'lucide-react';
import { EditExpenseModal } from '../features/expenses/components/EditExpenseModal';
import { useUiStore } from '../store/ui.store';

const CATEGORY_ICONS: Record<string, string> = {
  'Food & Drink': '🍽️',
  Transport: '🚗',
  Accommodation: '🏠',
  Entertainment: '🎬',
  Groceries: '🛒',
  Utilities: '💡',
  Health: '❤️',
  Shopping: '🛍️',
  Other: '📦',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Drink': 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  Transport: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  Accommodation: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  Entertainment: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  Groceries: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  Utilities: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  Health: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  Shopping: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  Other: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900/30 dark:text-zinc-400',
};

export default function ExpensesPage({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>(
    'date-desc',
  );

  const { data: expenses = [], isLoading } = useQuery(
    listWorkspaceExpensesOptions({
      path: { workspaceId },
      query: {
        search: search || undefined,
        currency: filterCurrency !== 'ALL' ? filterCurrency : undefined,
        category: filterCategory !== 'ALL' ? filterCategory : undefined,
        sortBy,
      },
    }),
  );

  const { data: members = [] } = useQuery(getWorkspaceMembersOptions({ path: { workspaceId } }));
  const deleteMutation = useMutation(deleteExpenseMutation());

  const getMemberName = (id: string) => members.find((m: any) => m.id === id)?.name || 'Unknown';

  const editingExpenseId = useUiStore((state) => state.editingExpenseId);
  const setEditingExpenseId = useUiStore((state) => state.setEditingExpenseId);

  // Hardcoded for UI dropdowns since we don't fetch metadata yet
  const currencies = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'];
  const categories = Object.keys(CATEGORY_ICONS);

  const filtered = expenses; // Backend handles filtering and sorting now

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      await deleteMutation.mutateAsync({ path: { expenseId: id } } as any);
      queryClient.invalidateQueries();
    }
  };

  const editingExpense = expenses.find((e: any) => e.id === editingExpenseId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-text-main">All Expenses</h1>
            <p className="text-text-muted text-sm mt-1">View, filter, and sort all transactions</p>
          </div>
        </header>

        <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-center justify-between z-10 relative">
          <div className="relative w-full md:w-1/3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex w-full md:w-auto gap-3 overflow-x-auto pb-1 md:pb-0">
            <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 min-w-max">
              <Filter className="w-4 h-4 text-text-muted" />
              <select
                value={filterCurrency}
                onChange={(e) => setFilterCurrency(e.target.value)}
                className="bg-transparent text-sm text-text-main focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Currencies</option>
                {currencies.map((c: any) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 min-w-max">
              <Filter className="w-4 h-4 text-text-muted" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-transparent text-sm text-text-main focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 min-w-max">
              <ArrowUpDown className="w-4 h-4 text-text-muted" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-sm text-text-main focus:outline-none cursor-pointer"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="amount-desc">Highest Amount</option>
                <option value="amount-asc">Lowest Amount</option>
              </select>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-xl overflow-hidden min-h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center text-text-muted">Loading expenses...</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center text-text-muted flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-text-muted" />
              </div>
              <p className="font-medium text-lg text-text-main">No expenses found</p>
              <p className="mt-1">Try adjusting your filters or search term.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((expense: any) => (
                <div
                  key={expense.id}
                  className="px-6 py-4 group hover:bg-surface/50 transition-colors flex items-center gap-4"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${CATEGORY_COLORS[expense.category] || CATEGORY_COLORS['Other']}`}
                  >
                    {CATEGORY_ICONS[expense.category] || CATEGORY_ICONS['Other']}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-text-main truncate">
                        {expense.description}
                      </p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface text-text-muted border border-border">
                        {expense.category}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {expense.splitType}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted flex items-center gap-1">
                      <span>
                        {new Date(expense.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span>•</span>
                      <span>Paid by {getMemberName(expense.paidBy)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-base font-bold text-text-main">
                        {formatCurrency(expense.amount, expense.currency || 'USD')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingExpenseId(expense.id)}
                        className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingExpenseId && editingExpense && (
        <EditExpenseModal
          expense={editingExpense as any}
          workspaceId={workspaceId}
          isOpen={true}
          onClose={() => setEditingExpenseId(null)}
        />
      )}
    </DashboardLayout>
  );
}
