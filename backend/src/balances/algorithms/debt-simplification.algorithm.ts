export interface Debt {
  debtor: string;
  creditor: string;
  amount: number;
}

/** A person's net position in minor units: positive = is owed, negative = owes. */
export interface MinorBalance {
  id: string;
  minor: number;
}

export interface MinorDebt {
  debtor: string;
  creditor: string;
  minor: number;
}

export class DebtSimplificationAlgorithm {
  /**
   * Minimises the number of payments needed to settle everyone, greedily matching the
   * largest debtor with the largest creditor. Works on integer minor units, so it is exact.
   */
  public settleUp(balances: MinorBalance[]): MinorDebt[] {
    const debtors = balances
      .filter((b) => b.minor < 0)
      .map((b) => ({ id: b.id, minor: -b.minor }))
      .sort((a, b) => b.minor - a.minor);
    const creditors = balances
      .filter((b) => b.minor > 0)
      .map((b) => ({ id: b.id, minor: b.minor }))
      .sort((a, b) => b.minor - a.minor);

    const payments: MinorDebt[] = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const minor = Math.min(debtors[i].minor, creditors[j].minor);
      payments.push({ debtor: debtors[i].id, creditor: creditors[j].id, minor });
      debtors[i].minor -= minor;
      creditors[j].minor -= minor;
      if (debtors[i].minor === 0) i++;
      if (creditors[j].minor === 0) j++;
    }
    return payments;
  }

  /** Convenience for decimal debts: nets them out, then settles up. */
  public simplifyDebts(debts: Debt[]): Debt[] {
    const nets = new Map<string, number>();
    for (const d of debts) {
      const minor = Math.round(d.amount * 100);
      nets.set(d.debtor, (nets.get(d.debtor) ?? 0) - minor);
      nets.set(d.creditor, (nets.get(d.creditor) ?? 0) + minor);
    }
    return this.settleUp([...nets].map(([id, minor]) => ({ id, minor }))).map((p) => ({
      debtor: p.debtor,
      creditor: p.creditor,
      amount: p.minor / 100,
    }));
  }
}
