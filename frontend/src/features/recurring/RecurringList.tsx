import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pause, Play, Repeat, SkipForward, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  deleteRecurringMutation,
  listRecurringOptions,
  listRecurringQueryKey,
  setRecurringActiveMutation,
  skipRecurringMutation,
} from '../../api/@tanstack/react-query.gen';
import { formatCurrency } from '../../utils/currency';

const LABEL = { DAILY: 'Every day', WEEKLY: 'Every week', MONTHLY: 'Every month' } as const;

export function RecurringList({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const { data: rules = [] } = useQuery(listRecurringOptions({ path: { workspaceId } }));
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: listRecurringQueryKey({ path: { workspaceId } }) });
  const onError = () => toast.error('Only the creator or an admin can change this');

  const toggle = useMutation({ ...setRecurringActiveMutation(), onSuccess: refresh, onError });
  const skip = useMutation({ ...skipRecurringMutation(), onSuccess: refresh, onError });
  const remove = useMutation({ ...deleteRecurringMutation(), onSuccess: refresh, onError });

  if (rules.length === 0) return null;

  return (
    <section className="glass-panel rounded-xl p-5">
      <h2 className="font-semibold text-text-main flex items-center gap-2 mb-3">
        <Repeat className="w-4 h-4" /> Recurring expenses
      </h2>
      <ul className="divide-y divide-border">
        {rules.map((r) => {
          const path = { workspaceId, ruleId: r.id };
          return (
            <li key={r.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${r.active ? 'text-text-main' : 'text-text-muted'}`}
                >
                  {r.template.description}{' '}
                  <span className="text-text-muted font-normal">
                    · {formatCurrency(r.template.amount ?? 0, r.template.currency || 'USD')}
                  </span>
                </p>
                <p className="text-xs text-text-muted">
                  {LABEL[r.interval]} ·{' '}
                  {r.active
                    ? `next ${new Date(r.nextRunAt).toLocaleDateString()}`
                    : `paused${r.lastError ? `: ${r.lastError}` : ''}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  title={r.active ? 'Pause' : 'Resume'}
                  onClick={() => toggle.mutate({ path, body: { active: !r.active } })}
                  className="p-2 text-text-muted hover:text-primary rounded-lg"
                >
                  {r.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                {r.active && (
                  <button
                    title="Skip next"
                    onClick={() => skip.mutate({ path })}
                    className="p-2 text-text-muted hover:text-primary rounded-lg"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}
                <button
                  title="Cancel"
                  onClick={() => remove.mutate({ path })}
                  className="p-2 text-text-muted hover:text-red-500 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
