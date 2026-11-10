import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../utils/currency';
import { getWorkspaceOptions, getBalancesOptions } from '../api/@tanstack/react-query.gen';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import DashboardLayout from '../layouts/DashboardLayout';
import { ReceiptSplitModal } from '../features/expenses/components/ReceiptSplitModal';
import { AddExpenseModal } from '../features/expenses/components/AddExpenseModal';
import { EditExpenseModal } from '../features/expenses/components/EditExpenseModal';
import { InviteMemberModal } from '../features/workspaces/components/InviteMemberModal';
import { WorkspaceSettingsModal } from '../features/workspaces/components/WorkspaceSettingsModal';
import { Settings } from 'lucide-react';
import { DebtSimplificationPanel } from '../features/balances/components/DebtSimplificationPanel';
import { Receipt, Plus, UserPlus, Activity } from 'lucide-react';
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
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Quick add: press "n" anywhere that isn't a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
      if (e.key.toLowerCase() === 'n' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsAddExpenseOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
        <PageSkeleton />
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
          <button onClick={() => setIsSettingsOpen(true)} className="btn-secondary">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button onClick={() => setIsInviteOpen(true)} className="btn-secondary">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Invite</span>
          </button>
          <button onClick={() => setIsReceiptOpen(true)} className="btn-secondary">
            <Receipt className="w-4 h-4" />
            <span className="hidden sm:inline">Scan receipt</span>
          </button>
          <button onClick={() => setIsAddExpenseOpen(true)} className="btn-primary">
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
              className="field max-w-[120px]"
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
      <ReceiptSplitModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        workspaceId={workspaceId}
      />
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
      <WorkspaceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        workspace={workspace}
      />
    </DashboardLayout>
  );
}
