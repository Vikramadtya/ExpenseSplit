import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDebtsOptions,
  getWorkspaceMembersOptions,
  createSettlementMutation,
} from '../../../api/@tanstack/react-query.gen';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';

interface Props {
  workspaceId: string;
}

export const DebtSimplificationPanel: React.FC<Props> = ({ workspaceId }) => {
  const queryClient = useQueryClient();
  const [isSimplificationEnabled, setIsSimplificationEnabled] = useState(true);

  const { data: debts = [] } = useQuery(
    getDebtsOptions({
      path: { workspaceId },
      query: { simplified: isSimplificationEnabled },
    }),
  );
  const { data: members = [] } = useQuery(getWorkspaceMembersOptions({ path: { workspaceId } }));

  const settleMutation = useMutation(createSettlementMutation());

  const getMemberName = (id: string) => members.find((m: any) => m.id === id)?.name || 'Unknown';

  const [confirmDebt, setConfirmDebt] = useState<{
    debtor: string;
    creditor: string;
    amount: number;
    currency?: string;
  } | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');

  const handleSettle = async () => {
    if (confirmDebt && settleAmount) {
      await settleMutation.mutateAsync({
        path: { workspaceId },
        body: {
          payerId: confirmDebt.debtor,
          payeeId: confirmDebt.creditor,
          amount: parseFloat(settleAmount),
          date: new Date().toISOString(),
        } as any,
      });
      queryClient.invalidateQueries();
      setConfirmDebt(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-3 cursor-pointer">
          <span className="text-sm font-medium text-text-muted">Debt Simplification</span>
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={isSimplificationEnabled}
              onChange={() => setIsSimplificationEnabled(!isSimplificationEnabled)}
            />
            <div
              className={`block w-10 h-6 rounded-full transition-colors ${isSimplificationEnabled ? 'bg-primary' : 'bg-border'}`}
            ></div>
            <div
              className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isSimplificationEnabled ? 'transform translate-x-4' : ''}`}
            ></div>
          </div>
        </label>
      </div>

      {debts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-medium text-emerald-900 dark:text-emerald-300 mb-2">
            All settled up!
          </h3>
          <p className="text-emerald-700 dark:text-emerald-400/80 text-center max-w-sm">
            No outstanding debts in this workspace. Everyone is square.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {debts.map((debt: any, i: number) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-surface rounded-2xl border border-border shadow-sm gap-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-text-main">
                    {getMemberName(debt.debtor)}
                  </span>
                  <span className="text-xs text-text-muted">Owes</span>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-text-main">
                    {getMemberName(debt.creditor)}
                  </span>
                  <span className="text-xs text-text-muted">Receives</span>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-lg font-bold text-text-main">
                  {formatCurrency(debt.amount, debt.currency || 'USD')}
                </span>
                <button
                  onClick={() => {
                    setConfirmDebt(debt);
                    setSettleAmount(debt.amount.toString());
                  }}

                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors shadow-sm whitespace-nowrap"
                >
                  Settle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-xl p-6 max-w-sm w-full border border-border">
            <h3 className="text-lg font-semibold text-text-main mb-2">Confirm Settlement</h3>
            <p className="text-text-muted mb-4 text-sm">
              Record a payment from{' '}
              <span className="font-semibold text-text-main">
                {getMemberName(confirmDebt.debtor)}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-text-main">
                {getMemberName(confirmDebt.creditor)}
              </span>
              .
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-text-muted mb-1">Amount</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-text-muted sm:text-sm">
                    {(confirmDebt.currency || 'USD') === 'USD' ? '$' : confirmDebt.currency}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={confirmDebt.amount}
                  className="input-field pl-12"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                />
              </div>
              <p className="text-xs text-text-muted mt-1">
                Full amount: {formatCurrency(confirmDebt.amount, confirmDebt.currency || 'USD')}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDebt(null)}
                className="px-4 py-2 text-sm font-medium text-text-muted hover:bg-background rounded-xl transition-colors border border-transparent hover:border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleSettle}
                disabled={!settleAmount || parseFloat(settleAmount) <= 0}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
              >
                Confirm Settle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
