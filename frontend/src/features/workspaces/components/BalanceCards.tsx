import { TrendingUp, TrendingDown } from 'lucide-react';

export interface BalanceData {
  total: number;
  owedToYou: number;
  youOwe: number;
}

interface BalanceCardsProps {
  balances: BalanceData;
}

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'always',
  }).format(amount);
};

export default function BalanceCards({ balances }: BalanceCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-10">
      <div className="glass-panel p-6 border-l-4 border-l-primary relative overflow-hidden group hover:scale-[1.02] transition-transform">
        <p className="text-text-muted text-sm font-medium mb-2">Total Balance</p>
        <h2 className="font-display text-3xl font-bold text-white">
          {formatCurrency(balances.total)}
        </h2>
      </div>

      <div className="glass-panel p-6 border-l-4 border-l-green-500 relative overflow-hidden group hover:scale-[1.02] transition-transform">
        <div className="absolute top-4 right-4 p-2 bg-green-500/10 rounded-full">
          <TrendingUp className="w-4 h-4 text-green-500" />
        </div>
        <p className="text-text-muted text-sm font-medium mb-2">You are owed</p>
        <h2 className="font-display text-3xl font-bold text-green-400">
          {formatCurrency(balances.owedToYou)}
        </h2>
      </div>

      <div className="glass-panel p-6 border-l-4 border-l-red-500 relative overflow-hidden group hover:scale-[1.02] transition-transform">
        <div className="absolute top-4 right-4 p-2 bg-red-500/10 rounded-full">
          <TrendingDown className="w-4 h-4 text-red-500" />
        </div>
        <p className="text-text-muted text-sm font-medium mb-2">You owe</p>
        <h2 className="font-display text-3xl font-bold text-red-400">
          {formatCurrency(-Math.abs(balances.youOwe))}
        </h2>
      </div>
    </div>
  );
}
