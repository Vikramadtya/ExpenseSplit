import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { getPaymentLinksOptions } from '../../api/@tanstack/react-query.gen';

interface Props {
  payeeId: string;
  amount: number;
  currency: string;
}

/**
 * Buttons that open the payer's own payment app. Money never moves through this app:
 * after paying, the payer confirms and records the settlement.
 */
export function PaymentLinks({ payeeId, amount, currency }: Props) {
  const { data } = useQuery({
    ...getPaymentLinksOptions({ query: { payeeId, amount, currency } }),
    enabled: amount > 0,
    retry: false,
  });
  if (!data || data.links.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-text-muted mb-2">Pay {data.payee.name} directly</p>
      <div className="flex flex-wrap gap-2">
        {data.links.map((link) => (
          <a
            key={link.method}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary border border-primary/30 hover:bg-primary/10 rounded-lg transition-colors"
          >
            {link.label}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ))}
      </div>
      <p className="text-xs text-text-muted mt-2">
        Pay in the app, then press Confirm Settle to record it.
      </p>
    </div>
  );
}
