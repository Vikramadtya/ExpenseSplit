import { DebtSimplificationAlgorithm, Debt } from './debt-simplification.algorithm';

describe('DebtSimplificationAlgorithm', () => {
  let algorithm: DebtSimplificationAlgorithm;

  beforeEach(() => {
    algorithm = new DebtSimplificationAlgorithm();
  });

  it('should be defined', () => {
    expect(algorithm).toBeDefined();
  });

  describe('simplifyDebts', () => {
    it('should return an empty array if there are no debts', () => {
      const result = algorithm.simplifyDebts([]);
      expect(result).toEqual([]);
    });

    it('should simplify a basic A -> B -> C cycle into A -> C', () => {
      const debts: Debt[] = [
        { debtor: 'A', creditor: 'B', amount: 100 },
        { debtor: 'B', creditor: 'C', amount: 100 },
      ];

      const result = algorithm.simplifyDebts(debts);

      // Expected: A owes C 100
      expect(result.length).toBe(1);
      expect(result).toContainEqual({
        debtor: 'A',
        creditor: 'C',
        amount: 100,
      });
    });

    it('should completely eliminate circular debts (A -> B -> C -> A)', () => {
      const debts: Debt[] = [
        { debtor: 'A', creditor: 'B', amount: 50 },
        { debtor: 'B', creditor: 'C', amount: 50 },
        { debtor: 'C', creditor: 'A', amount: 50 },
      ];

      const result = algorithm.simplifyDebts(debts);

      expect(result.length).toBe(0);
    });

    it('should handle complex unequal circular debts', () => {
      const debts: Debt[] = [
        { debtor: 'A', creditor: 'B', amount: 50 },
        { debtor: 'B', creditor: 'C', amount: 100 },
        { debtor: 'C', creditor: 'A', amount: 20 },
      ];

      const result = algorithm.simplifyDebts(debts);

      // Net balances:
      // A: -50 + 20 = -30 (owes 30)
      // B: +50 - 100 = -50 (owes 50)
      // C: +100 - 20 = +80 (is owed 80)

      expect(result.length).toBe(2);
      expect(result).toContainEqual({ debtor: 'B', creditor: 'C', amount: 50 });
      expect(result).toContainEqual({ debtor: 'A', creditor: 'C', amount: 30 });
    });
  });
});
