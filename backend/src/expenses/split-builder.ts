import { BadRequestException } from '@nestjs/common';
import { Money } from '../common/money/money';
import { OwedAmount } from './strategies/split.strategy';

export interface SplitRow {
  userId: string;
  owed: Money;
  paid: Money;
}

/** Merges what each person owes with what each person paid into one row per user. */
export function buildSplitRows(
  total: Money,
  owed: OwedAmount[],
  payers: { userId: string; amount: number }[],
): SplitRow[] {
  const paid = new Map<string, Money>();
  for (const payer of payers) {
    const amount = Money.fromMajor(payer.amount, total.currency);
    paid.set(payer.userId, (paid.get(payer.userId) ?? Money.zero(total.currency)).add(amount));
  }

  const paidTotal = [...paid.values()].reduce((a, b) => a.add(b), Money.zero(total.currency));
  if (!paidTotal.equals(total)) {
    throw new BadRequestException(
      `Payers paid ${paidTotal.toDecimal()}, expected ${total.toDecimal()}`,
    );
  }

  const rows = new Map<string, SplitRow>();
  for (const o of owed) {
    rows.set(o.userId, { userId: o.userId, owed: o.owed, paid: Money.zero(total.currency) });
  }
  for (const [userId, amount] of paid) {
    const row = rows.get(userId) ?? { userId, owed: Money.zero(total.currency), paid: amount };
    rows.set(userId, { ...row, paid: amount });
  }
  return [...rows.values()];
}
