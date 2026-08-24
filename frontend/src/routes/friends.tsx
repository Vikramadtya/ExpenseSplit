import { useQuery } from '@tanstack/react-query';
import { getFriendsBalancesOptions } from '../api/@tanstack/react-query.gen';
import DashboardLayout from '../layouts/DashboardLayout';
import { Users, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

export default function FriendsRoute() {
  const { data: friends = [], isLoading } = useQuery(getFriendsBalancesOptions());

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 border border-indigo-200 rounded-lg flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Friends</h1>
              <p className="text-text-muted text-sm mt-0.5">
                Global balances across all your workspaces
              </p>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-surface rounded-xl border border-border"></div>
            ))}
          </div>
        ) : friends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-surface rounded-2xl border border-border text-text-muted">
            <CheckCircle2 className="w-12 h-12 mb-4 text-emerald-500 opacity-50" />
            <h3 className="text-lg font-medium text-text-main">You're all settled up globally!</h3>
            <p className="mt-2 text-center max-w-sm">
              You don't owe anyone, and nobody owes you across any of your workspaces.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {friends.map((friend: any) => (
              <div
                key={friend.userId}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-surface rounded-2xl border border-border shadow-sm gap-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {friend.avatarUrl ? (
                    <img
                      src={friend.avatarUrl}
                      alt={friend.name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {friend.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-text-main">{friend.name}</h3>
                    <p
                      className={`text-sm font-medium ${friend.netBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : friend.netBalance < 0 ? 'text-orange-600 dark:text-orange-400' : 'text-text-muted'}`}
                    >
                      {friend.netBalance > 0
                        ? 'Owes you'
                        : friend.netBalance < 0
                          ? 'You owe'
                          : 'Settled'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <span
                    className={`text-xl font-bold ${friend.netBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : friend.netBalance < 0 ? 'text-orange-600 dark:text-orange-400' : 'text-text-main'}`}
                  >
                    {formatCurrency(Math.abs(friend.netBalance), friend.currency || 'USD')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
