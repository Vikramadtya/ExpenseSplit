import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Target, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  deleteBudgetMutation,
  getWorkspaceOptions,
  listBudgetsOptions,
  listBudgetsQueryKey,
  setBudgetMutation,
} from '../../api/@tanstack/react-query.gen';
import { formatCurrency } from '../../utils/currency';
import { useCategories } from '../categories/useCategories';

const barColor = (percent: number) =>
  percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

/** Monthly spending limits. The group is notified at 80% and 100%. */
export function BudgetsPanel({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const { roots, childrenOf, iconOf } = useCategories(workspaceId);
  const { data: budgets = [] } = useQuery(listBudgetsOptions({ path: { workspaceId } }));
  const { data: workspace } = useQuery(getWorkspaceOptions({ path: { workspaceId } }));
  const [category, setCategory] = useState('ALL');
  const [amount, setAmount] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: listBudgetsQueryKey({ path: { workspaceId } }) });
  const onError = () => toast.error('Only workspace admins can change budgets');

  const save = useMutation({
    ...setBudgetMutation(),
    onSuccess: () => {
      setAmount('');
      setAdding(false);
      refresh();
    },
    onError,
  });
  const remove = useMutation({ ...deleteBudgetMutation(), onSuccess: refresh, onError });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (value > 0) {
      save.mutate({
        path: { workspaceId },
        body: { category, currency: workspace?.defaultCurrency ?? 'USD', amount: value },
      });
    }
  };

  return (
    <section className="bg-surface p-6 rounded-xl shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
          <Target className="w-5 h-5" /> Monthly budgets
        </h2>
        <button
          onClick={() => setAdding(!adding)}
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Set a budget
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} className="flex flex-wrap gap-2 mb-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Budget category"
            className="field w-auto"
          >
            <option value="ALL">Everything</option>
            {roots.map((root) => [
              <option key={root.id} value={root.name}>
                {root.icon} {root.name}
              </option>,
              ...childrenOf(root.id).map((kid) => (
                <option key={kid.id} value={kid.name}>
                  {'\u00a0\u00a0\u00a0'}
                  {kid.icon} {kid.name}
                </option>
              )),
            ])}
          </select>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder={`Limit in ${workspace?.defaultCurrency ?? 'USD'}`}
            aria-label="Budget amount"
            className="field w-40"
          />
          <button type="submit" disabled={save.isPending} className="btn-primary">
            Save
          </button>
        </form>
      )}

      {budgets.length === 0 ? (
        <p className="text-sm text-text-muted">
          No budgets yet. Set one and everyone is warned as spending nears the limit.
        </p>
      ) : (
        <ul className="space-y-4">
          {budgets.map((b) => (
            <li key={b.id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-text-main">
                  {b.category === 'ALL' ? 'Everything' : `${iconOf(b.category)} ${b.category}`}
                </span>
                <span className="text-text-muted">
                  {formatCurrency(b.spent, b.currency)} of {formatCurrency(b.amount, b.currency)} ·{' '}
                  {b.percent}%
                  <button
                    onClick={() => remove.mutate({ path: { workspaceId, budgetId: b.id } })}
                    aria-label="Remove budget"
                    className="ml-2 align-middle text-text-muted hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
              <div
                className="h-2 rounded-full bg-border overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.min(b.percent, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full ${barColor(b.percent)}`}
                  style={{ width: `${Math.min(b.percent, 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
