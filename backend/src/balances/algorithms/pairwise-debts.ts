import { Money } from '../../common/money/money';
import type { SettlementRecord, SplitRecord } from '../../common/interfaces/repository.interfaces';
import type { MinorDebt } from './debt-simplification.algorithm';

/**
 * The un-simplified "who owes whom" view. Per expense, each person who owes more than they
 * paid covers their shortfall to the people who overpaid, in proportion to the overpayment.
 * Settlements then reduce the matching pair.
 */
export function pairwiseDebts(
  currency: string,
  splits: SplitRecord[],
  settlements: SettlementRecord[],
): MinorDebt[] {
  // owes.get(`${a}|${b}`) = how much a owes b (minor units); may go negative before netting
  const owes = new Map<string, number>();
  const add = (debtor: string, creditor: string, minor: number) => {
    const key = `${debtor}|${creditor}`;
    owes.set(key, (owes.get(key) ?? 0) + minor);
  };

  const byExpense = new Map<string, SplitRecord[]>();
  for (const s of splits) {
    byExpense.set(s.expenseId, [...(byExpense.get(s.expenseId) ?? []), s]);
  }

  for (const rows of byExpense.values()) {
    const creditors = rows
      .map((r) => ({ id: r.userId, minor: r.paid.minor - r.owed.minor }))
      .filter((r) => r.minor > 0);
    if (creditors.length === 0) continue;
    const weights = creditors.map((c) => c.minor);
    for (const row of rows) {
      const shortfall = row.owed.minor - row.paid.minor;
      if (shortfall <= 0) continue;
      const parts = Money.fromMinor(shortfall, currency).allocate(weights);
      creditors.forEach((c, i) => add(row.userId, c.id, parts[i].minor));
    }
  }

  for (const s of settlements) add(s.payerId, s.payeeId, -s.amount.minor);

  const debts: MinorDebt[] = [];
  for (const [key, minor] of owes) {
    const [debtor, creditor] = key.split('|');
    const reverse = owes.get(`${creditor}|${debtor}`) ?? 0;
    // Emit each pair once, from the side with the larger obligation.
    if (minor - reverse > 0) debts.push({ debtor, creditor, minor: minor - reverse });
  }
  return debts;
}
