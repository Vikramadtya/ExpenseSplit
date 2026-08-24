import { Link, useSearch, useLocation } from '@tanstack/react-router';
import { Home, LayoutGrid, LogOut, BarChart2, List, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUserOptions } from '../api/@tanstack/react-query.gen';
import { ThemeToggle } from '../features/theme/components/ThemeToggle';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const { data: currentUser } = useQuery(getCurrentUserOptions());
  const [showProfile, setShowProfile] = useState(false);
  let workspaceId = '';
  try {
    const search = useSearch({ strict: false }) as any;
    workspaceId = search?.workspaceId ?? '';
  } catch {
    /* root route has no search */
  }

  const navLink = (to: string, icon: React.ReactNode, label: string) => {
    const isActive = location.pathname.startsWith(to);
    return (
      <Link
        to={to}
        search={{ workspaceId }}
        className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-text-muted hover:bg-surface hover:text-text-main'
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-primary/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Top Nav Bar */}
      <header className="glass-panel mx-4 mt-4 px-6 py-3 flex items-center justify-between z-20 border-border/50 sticky top-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-6">
          <Link
            to="/workspaces"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity mr-4"
          >
            <LayoutGrid className="w-5 h-5 text-primary" />
            <span className="font-display font-bold tracking-wide">ExpenseSplit</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 bg-surface/50 p-1 rounded-full border border-border/30">
            {navLink('/dashboard', <Home className="w-4 h-4" />, 'Overview')}
            {navLink('/expenses', <List className="w-4 h-4" />, 'Expenses')}
            {navLink('/members', <Users className="w-4 h-4" />, 'Members')}
            {navLink('/analytics', <BarChart2 className="w-4 h-4" />, 'Analytics')}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {currentUser && (
            <button
              onClick={() => setShowProfile(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border hover:bg-surface/80 transition-colors"
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
              <span className="text-sm font-medium ">{currentUser.name || currentUser.email}</span>
            </button>
          )}
          <Link
            to="/workspaces"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-text-muted hover:bg-surface hover:text-text-main transition-colors text-sm font-medium border border-transparent hover:border-border/50"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Workspaces</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 overflow-y-auto z-10 animate-slide-up mt-4">
        {children}
      </main>

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
