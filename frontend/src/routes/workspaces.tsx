import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { useAppStore } from '../store/app.store';
import {
  getWorkspacesOptions,
  createWorkspaceMutation,
  getGlobalAnalyticsOptions,
  getGlobalBalancesOptions,
  getCurrentUserOptions,
} from '../api/@tanstack/react-query.gen';
import { ThemeToggle } from '../features/theme/components/ThemeToggle';
import { LayoutGrid, LogOut, X, Users } from 'lucide-react';

import { GlobalOverview } from '../features/workspaces/components/GlobalOverview';
import { WorkspaceList } from '../features/workspaces/components/WorkspaceList';

function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const queryClient = useQueryClient();
  const createMutation = useMutation({
    ...createWorkspaceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getWorkspacesOptions().queryKey });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      createMutation.mutate({ body: { name: name.trim(), defaultCurrency } });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-panel w-full max-w-sm relative z-10 animate-slide-up overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-display font-bold">New Workspace</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-text-main hover:bg-border transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form className="p-5 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Workspace Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apartment 4B"
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Default Currency
            </label>
            <select
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-muted hover:text-text-main transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary text-sm"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkspacesRoute() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('');

  const { data: workspaces = [], isLoading: isLoadingWorkspaces } =
    useQuery(getWorkspacesOptions());
  const { data: currentUser } = useQuery(getCurrentUserOptions());
  const [showProfile, setShowProfile] = useState(false);
  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery(getGlobalAnalyticsOptions());
  const { data: balances, isLoading: isLoadingBalances } = useQuery(getGlobalBalancesOptions());

  const setGlobalData = useAppStore((state) => state.setGlobalData);
  const globalBalances = useAppStore((state) => state.globalBalances);

  useEffect(() => {
    if (analytics && balances) {
      setGlobalData(analytics, balances);
    }
  }, [analytics, balances, setGlobalData]);

  const displayBalances = balances || globalBalances;

  const balancesByCurrency = displayBalances?.byCurrency || [];

  useEffect(() => {
    if (!selectedCurrency && balancesByCurrency.length > 0) {
      setSelectedCurrency(balancesByCurrency[0].currency);
    }
  }, [balancesByCurrency, selectedCurrency]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-[0%] left-[50%] -translate-x-1/2 w-[80%] h-[40%] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 relative z-10 animate-fade-in">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface border border-border rounded-lg flex items-center justify-center shadow-lg">
              <LayoutGrid className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">ExpenseSplit</h1>
              <p className="text-text-muted text-xs mt-0.5">Manage your expenses and balances</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentUser && (
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border hover:bg-surface/80 transition-colors"
              >
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                    {currentUser.name?.charAt(0) || currentUser.email?.charAt(0) || 'U'}
                  </div>
                )}
                <span className="text-sm font-medium hidden sm:block">
                  {currentUser.name || currentUser.email}
                </span>
              </button>
            )}

            <Link
              to="/friends"
              className="text-text-muted hover:text-text-main transition-colors flex items-center gap-2 text-sm ml-2 mr-2"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:block">Friends</span>
            </Link>
            <Link
              to="/login"

              onClick={() => localStorage.removeItem('access_token')}
              className="text-text-muted hover:text-text-main transition-colors flex items-center gap-2 text-sm ml-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sign Out</span>
            </Link>
          </div>
        </header>

        <div className="space-y-12">
          <div>
            <GlobalOverview
              isLoading={isLoadingAnalytics || isLoadingBalances}
              analytics={analytics}
              balances={displayBalances}
              selectedCurrency={selectedCurrency}
              setSelectedCurrency={setSelectedCurrency}
            />
          </div>

          <div className="pt-8 border-t border-border/50">
            <WorkspaceList
              workspaces={workspaces}
              isLoading={isLoadingWorkspaces}
              setShowCreate={setShowCreate}
            />
          </div>
        </div>
      </div>

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} />}

      {showProfile && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-xl p-6 max-w-sm w-full border border-border text-center">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowProfile(false)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-background shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold mx-auto mb-4 border-4 border-background shadow-sm">
                {currentUser.name?.charAt(0) || currentUser.email?.charAt(0) || 'U'}
              </div>
            )}
            <h3 className="text-xl font-semibold text-text-main mb-1">
              {currentUser.name || 'Anonymous User'}
            </h3>
            <p className="text-text-muted text-sm mb-6">{currentUser.email}</p>
            <div className="bg-background rounded-xl p-3 border border-border flex flex-col gap-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-text-muted">User ID</span>
                <span className="font-mono text-xs text-text-main truncate max-w-[150px]">
                  {currentUser.id}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
