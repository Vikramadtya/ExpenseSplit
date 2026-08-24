import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../utils/currency';
import { getWorkspaceOptions, getBalancesOptions } from '../api/@tanstack/react-query.gen';
import DashboardLayout from '../layouts/DashboardLayout';
import { AddExpenseModal } from '../features/expenses/components/AddExpenseModal';
import { EditExpenseModal } from '../features/expenses/components/EditExpenseModal';
import { InviteMemberModal } from '../features/workspaces/components/InviteMemberModal';
import { DebtSimplificationPanel } from '../features/balances/components/DebtSimplificationPanel';
import { Plus, UserPlus, BarChart2, Users, Activity } from 'lucide-react';
import { RecentActivity } from '../features/workspaces/components/RecentActivity';

export default function DashboardRoute({ workspaceId }: { workspaceId: string }) {
  const { data: workspace, isLoading: isWorkspaceLoading } = useQuery(
    getWorkspaceOptions({ path: { workspaceId } }),
  );
  const { data: balancesData, isLoading: isBalancesLoading } = useQuery(
    getBalancesOptions({ path: { workspaceId } }),
  );

  const balances = balancesData ?? { byCurrency: [] };

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);

  const [selectedCurrency, setSelectedCurrency] = useState<string>('');

  useEffect(() => {
    if (!selectedCurrency && balances.byCurrency.length > 0) {
      setSelectedCurrency(balances.byCurrency[0].currency);
    }
  }, [balances.byCurrency, selectedCurrency]);

  if (isWorkspaceLoading || isBalancesLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-text-muted">Loading dashboard...</p>
        </div>
      </DashboardLayout>
    );
  }

  const activeBalance =
    balances.byCurrency.find((b: any) => b.currency === selectedCurrency) || balances.byCurrency[0];

  return (
    <DashboardLayout>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-text-main">
            {workspace?.name || 'Workspace'}
          </h1>
          <p className="text-text-muted text-sm mt-1">Manage balances & recent activity</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/analytics"
            search={{ workspaceId }}
            className="flex items-center gap-2 bg-surface border border-border text-text-muted hover:text-text-main font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            <BarChart2 className="w-4 h-4" />
            <span className="hidden sm:inline">Analytics</span>
          </Link>
          <Link
            to="/members"
            search={{ workspaceId }}
            className="flex items-center gap-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Members</span>
          </Link>
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-2 bg-surface border border-border text-text-muted hover:text-text-main font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Invite</span>
          </button>
          <button
            onClick={() => setIsAddExpenseOpen(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </header>

      {/* Balance Cards */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
            Balances Overview
          </h3>
          {balances.byCurrency.length > 1 && (
            <select
              value={selectedCurrency || ''}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="input-field max-w-[120px] text-sm py-1.5 bg-surface border-border"
            >
              {balances.byCurrency.map((b: any) => (
                <option key={b.currency} value={b.currency}>
                  {b.currency}
                </option>
              ))}
            </select>
          )}
        </div>

        {!activeBalance ? (
          <div className="text-sm text-text-muted bg-surface p-6 rounded-xl border border-border">
            No balances available.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel p-5 border-l-4 border-l-primary hover:scale-[1.01] transition-transform">
              <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">
                Net Balance
              </p>
              <p
                className={`font-display text-2xl font-bold ${activeBalance.total >= 0 ? 'text-text-main' : 'text-red-500'}`}
              >
                {formatCurrency(activeBalance.total, activeBalance.currency)}
              </p>
            </div>
            <div className="glass-panel p-5 border-l-4 border-l-green-500 hover:scale-[1.01] transition-transform">
              <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">
                You Are Owed
              </p>
              <p className="font-display text-2xl font-bold text-green-500">
                {formatCurrency(activeBalance.owedToYou, activeBalance.currency)}
              </p>
            </div>
            <div className="glass-panel p-5 border-l-4 border-l-red-500 hover:scale-[1.01] transition-transform">
              <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">
                You Owe
              </p>
              <p className="font-display text-2xl font-bold text-red-500">
                {formatCurrency(activeBalance.youOwe, activeBalance.currency)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Main Section */}
        <div className="lg:col-span-2 space-y-8">
          {/* Settle Up */}
          <div className="glass-panel border-border/50 overflow-hidden flex flex-col min-h-[300px]">
            <div className="p-6 border-b border-border/50 bg-surface/30 flex-shrink-0">
              <h3 className="text-xl font-display font-bold">Settle Up</h3>
              <p className="text-sm text-text-muted mt-1">
                Review outstanding balances and clear all debts
              </p>
            </div>
            <div className="flex-1 p-6">
              <DebtSimplificationPanel workspaceId={workspaceId} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-text-main flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Recent Activity
            </h2>
          </div>
          <RecentActivity workspaceId={workspaceId} />
        </div>
      </div>

      {/* Modals */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        workspaceId={workspaceId}
      />
      <EditExpenseModal
        isOpen={editingExpense !== null}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
        workspaceId={workspaceId}
      />
      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        workspaceId={workspaceId}
      />
    </DashboardLayout>
  );
}
