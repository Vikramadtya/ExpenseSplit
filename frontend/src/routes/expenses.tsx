import { useState } from 'react';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounced } from '../hooks/useDebounced';
import DashboardLayout from '../layouts/DashboardLayout';
import {
  listWorkspaceExpensesOptions,
  getWorkspaceMembersOptions,
  deleteExpenseMutation,
  restoreExpenseMutation,
} from '../api/@tanstack/react-query.gen';
import { formatCurrency } from '../utils/currency';
import { Search, Filter, ArrowUpDown, Pencil, Trash2, Settings2, Hash } from 'lucide-react';
import { EditExpenseModal } from '../features/expenses/components/EditExpenseModal';
import { CurrencySelect } from '../features/currency/CurrencySelect';
import { DataTransferMenu } from '../features/data/DataTransferMenu';
import { RecurringList } from '../features/recurring/RecurringList';
import { CategoryManager } from '../features/categories/CategoryManager';
import { CategoryPicker } from '../features/categories/CategoryPicker';
import { useCategories } from '../features/categories/useCategories';
import { TagInput } from '../features/tags/TagInput';
import { useUiStore } from '../store/ui.store';
import toast from 'react-hot-toast';

export default function ExpensesPage({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 250);
  const [filterCurrency, setFilterCurrency] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [managingCategories, setManagingCategories] = useState(false);
  const { iconOf, styleOf, pathOf } = useCategories(workspaceId);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>(
    'date-desc',
  );

  const listOptions = listWorkspaceExpensesOptions({
    path: { workspaceId },
    query: {
      search: debouncedSearch || undefined,
      currency: filterCurrency !== 'ALL' ? filterCurrency : undefined,
      category: filterCategory !== 'ALL' ? filterCategory : undefined,
      tags: filterTags.length ? filterTags.join(',') : undefined,
      sortBy,
    },
  });
  // Keep showing the previous results while a new filter loads, instead of flashing a skeleton.
  const { data: expenses = [], isLoading } = useQuery({
    ...listOptions,
    placeholderData: keepPreviousData,
  });

  const { data: members = [] } = useQuery(getWorkspaceMembersOptions({ path: { workspaceId } }));
  const deleteMutation = useMutation(deleteExpenseMutation());
  const restoreMutation = useMutation(restoreExpenseMutation());

  const getMemberName = (id: string) => members.find((m: any) => m.id === id)?.name || 'Unknown';

  const editingExpenseId = useUiStore((state) => state.editingExpenseId);
  const setEditingExpenseId = useUiStore((state) => state.setEditingExpenseId);

  const filtered = expenses; // Backend handles filtering and sorting now

  // Deleting is instant and undoable: the row disappears at once, and the toast offers Undo.
  const handleDelete = async (id: string) => {
    const previous = queryClient.getQueryData<any[]>(listOptions.queryKey);
    queryClient.setQueryData<any[]>(listOptions.queryKey, (old) => old?.filter((e) => e.id !== id));
    try {
      await deleteMutation.mutateAsync({ path: { expenseId: id } });
    } catch {
      queryClient.setQueryData(listOptions.queryKey, previous);
      toast.error('Could not delete the expense');
      return;
    }
    queryClient.invalidateQueries();

    toast(
      (t) => (
        <span className="flex items-center gap-3">
          Expense deleted
          <button
            className="font-semibold text-indigo-500 hover:underline"
            onClick={async () => {
              toast.dismiss(t.id);
              await restoreMutation.mutateAsync({ path: { expenseId: id } });
              queryClient.invalidateQueries();
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 8000 },
    );
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
          <DataTransferMenu workspaceId={workspaceId} />
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
              <CurrencySelect
                value={filterCurrency}
                onChange={setFilterCurrency}
                allLabel="All Currencies"
                ariaLabel="Currency filter"
                className="bg-transparent text-sm text-text-main focus:outline-none cursor-pointer max-w-[11rem]"
              />
            </div>

            <CategoryPicker
              workspaceId={workspaceId}
              value={filterCategory}
              onChange={setFilterCategory}
              allLabel="All categories"
              onManage={() => setManagingCategories(true)}
              variant="bar"
            />

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

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <TagInput
              workspaceId={workspaceId}
              value={filterTags}
              onChange={setFilterTags}
              placeholder="Filter by tag…"
            />
          </div>
          <button
            type="button"
            onClick={() => setManagingCategories(true)}
            className="press inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-main hover:border-primary/50"
          >
            <Settings2 className="h-4 w-4" /> Categories
          </button>
        </div>

        <RecurringList workspaceId={workspaceId} />

        <div className="glass-panel rounded-xl overflow-hidden min-h-[400px]">
          {isLoading ? (
            <div className="divide-y divide-border" aria-busy="true" aria-label="Loading expenses">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="skeleton h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-1/3" />
                    <div className="skeleton h-3 w-1/4" />
                  </div>
                  <div className="skeleton h-5 w-20" />
                </div>
              ))}
            </div>
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
              {filtered.map((expense: any, index: number) => (
                <div
                  key={expense.id}
                  style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                  className="anim-fade px-6 py-4 group hover:bg-surface/50 transition-colors flex items-center gap-4"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                    style={styleOf(expense.category)}
                  >
                    {iconOf(expense.category)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-text-main truncate">
                        {expense.description}
                      </p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface text-text-muted border border-border">
                        {pathOf(expense.category)}
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
                    {expense.tags?.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {expense.tags.map((tag: string) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setFilterTags((t) => (t.includes(tag) ? t : [...t, tag]))
                            }
                            className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
                          >
                            <Hash className="h-3 w-3" />
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
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

      {managingCategories && (
        <CategoryManager workspaceId={workspaceId} onClose={() => setManagingCategories(false)} />
      )}

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
