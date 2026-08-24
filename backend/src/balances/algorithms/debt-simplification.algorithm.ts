export interface Debt {
  debtor: string;
  creditor: string;
  amount: number;
}

export class DebtSimplificationAlgorithm {
  /**
   * Simplifies a list of debts by calculating net balances and settling them greedily.
   * This is a graph algorithm that minimizes the total number of transactions.
   */
  public simplifyDebts(debts: Debt[]): Debt[] {
    if (debts.length === 0) return [];

    // 1. Calculate net balances for each person
    const balances = new Map<string, number>();

    for (const debt of debts) {
      balances.set(debt.debtor, (balances.get(debt.debtor) || 0) - debt.amount);
      balances.set(debt.creditor, (balances.get(debt.creditor) || 0) + debt.amount);
    }

    // 2. Separate into debtors (negative balance) and creditors (positive balance)
    const debtors: { id: string; amount: number }[] = [];
    const creditors: { id: string; amount: number }[] = [];

    for (const [id, amount] of balances.entries()) {
      // Use a small epsilon to avoid floating point precision issues
      if (amount < -0.001) debtors.push({ id, amount: Math.abs(amount) });
      else if (amount > 0.001) creditors.push({ id, amount });
    }

    // Sort to optimize matching (largest debtor with largest creditor)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const simplifiedDebts: Debt[] = [];
    let i = 0; // index for debtors
    let j = 0; // index for creditors

    // 3. Greedily match debtors to creditors
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      // The settlement amount is the minimum of what is owed and what is due
      const settlementAmount = Math.min(debtor.amount, creditor.amount);

      simplifiedDebts.push({
        debtor: debtor.id,
        creditor: creditor.id,
        // Round to 2 decimal places to keep currency clean
        amount: Math.round(settlementAmount * 100) / 100,
      });

      // Deduct the settled amount
      debtor.amount -= settlementAmount;
      creditor.amount -= settlementAmount;

      // If the debtor is fully settled, move to the next
      if (Math.abs(debtor.amount) < 0.001) i++;
      // If the creditor is fully settled, move to the next
      if (Math.abs(creditor.amount) < 0.001) j++;
    }

    return simplifiedDebts;
  }
}
