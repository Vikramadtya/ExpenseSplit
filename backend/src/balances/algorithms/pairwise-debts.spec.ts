import { Money } from '../../common/money/money';
import { pairwiseDebts } from './pairwise-debts';
import { DebtSimplificationAlgorithm } from './debt-simplification.algorithm';

const usd = (n: number) => Money.fromMajor(n, 'USD');
const split = (expenseId: string, userId: string, owed: number, paid: number) => ({
  expenseId,
  userId,
  owed: usd(owed),
  paid: usd(paid),
});

describe('pairwiseDebts', () => {
  it('charges non-payers to the payer', () => {
    const debts = pairwiseDebts(
      'USD',
      [split('e1', 'a', 30, 90), split('e1', 'b', 30, 0), split('e1', 'c', 30, 0)],
      [],
    );
    expect(debts).toEqual([
      { debtor: 'b', creditor: 'a', minor: 3000 },
      { debtor: 'c', creditor: 'a', minor: 3000 },
    ]);
  });

  it('splits a debtor across several payers in proportion to what they paid', () => {
    const debts = pairwiseDebts(
      'USD',
      [split('e1', 'a', 10, 20), split('e1', 'b', 10, 10), split('e1', 'c', 10, 0)],
      [],
    );
    expect(debts).toEqual([{ debtor: 'c', creditor: 'a', minor: 1000 }]);
  });

  it('reduces a debt by settlements and nets opposite directions', () => {
    const splits = [
      split('e1', 'a', 0, 100),
      split('e1', 'b', 100, 0),
      split('e2', 'b', 0, 40),
      split('e2', 'a', 40, 0),
    ];
    expect(pairwiseDebts('USD', splits, [])).toEqual([{ debtor: 'b', creditor: 'a', minor: 6000 }]);
    expect(pairwiseDebts('USD', splits, [{ payerId: 'b', payeeId: 'a', amount: usd(60) }])).toEqual(
      [],
    );
  });
});

describe('DebtSimplificationAlgorithm.settleUp', () => {
  it('settles with the fewest payments and conserves money', () => {
    const payments = new DebtSimplificationAlgorithm().settleUp([
      { id: 'a', minor: -3000 },
      { id: 'b', minor: -2000 },
      { id: 'c', minor: 5000 },
    ]);
    expect(payments).toEqual([
      { debtor: 'a', creditor: 'c', minor: 3000 },
      { debtor: 'b', creditor: 'c', minor: 2000 },
    ]);
  });
});
