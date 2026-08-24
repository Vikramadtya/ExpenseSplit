import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActivityOptions } from '../../../api/@tanstack/react-query.gen';
import { Receipt, DollarSign, Clock } from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';

export const RecentActivity: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const { data: activity = [], isLoading } = useQuery(
    getActivityOptions({ path: { workspaceId } }),
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-surface rounded-xl border border-border"></div>
        ))}
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-surface rounded-2xl border border-border text-text-muted">
        <Clock className="w-8 h-8 mb-2 opacity-50" />
        <p>No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activity.map((item: any) => (
        <div
          key={item.id}
          className="flex items-center gap-4 p-4 bg-surface rounded-2xl border border-border hover:border-primary/50 transition-colors"
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              item.type === 'EXPENSE'
                ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'
                : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
            }`}
          >
            {item.type === 'EXPENSE' ? (
              <Receipt className="w-5 h-5" />
            ) : (
              <DollarSign className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-text-main text-sm">{item.description}</h4>
            <p className="text-xs text-text-muted mt-0.5">
              {item.actionBy} • {new Date(item.date).toLocaleDateString()}
            </p>
          </div>
          <div
            className={`font-bold ${item.type === 'EXPENSE' ? 'text-text-main' : 'text-emerald-600 dark:text-emerald-400'}`}
          >
            {formatCurrency(item.amount, 'USD')}
          </div>
        </div>
      ))}
    </div>
  );
};
