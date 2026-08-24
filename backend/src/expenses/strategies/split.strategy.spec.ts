import { SplitContext } from './split.context';
import { EqualSplitStrategy } from './equal-split.strategy';
import { ExactSplitStrategy } from './exact-split.strategy';
import { BadRequestException } from '@nestjs/common';

describe('Split Strategies', () => {
  describe('EqualSplitStrategy', () => {
    it('should split the total amount equally among all participants', () => {
      const strategy = new EqualSplitStrategy();
      const context = new SplitContext(strategy);

      const totalAmount = 100;
      const participants = ['A', 'B', 'C', 'D'];

      const result = context.executeSplit(totalAmount, participants, []);

      expect(result).toHaveLength(4);
      result.forEach((split) => {
        expect(split.amountOwed).toBe(25);
      });
    });

    it('should handle rounding remainders gracefully', () => {
      const strategy = new EqualSplitStrategy();
      const context = new SplitContext(strategy);

      const totalAmount = 100;
      const participants = ['A', 'B', 'C'];

      const result = context.executeSplit(totalAmount, participants, []);

      // 100 / 3 = 33.33...
      // Expected splits: 33.34, 33.33, 33.33
      const sum = result.reduce((acc, curr) => acc + curr.amountOwed, 0);
      expect(sum).toBe(100);

      // Ensure no split is more than 0.01 apart
      const amounts = result.map((r) => r.amountOwed);
      const max = Math.max(...amounts);
      const min = Math.min(...amounts);
      expect(max - min).toBeCloseTo(0.01, 2);
    });
  });

  describe('ExactSplitStrategy', () => {
    it('should split according to exact amounts provided', () => {
      const strategy = new ExactSplitStrategy();
      const context = new SplitContext(strategy);

      const totalAmount = 100;
      const participants = ['A', 'B'];
      const exactAmounts = [
        { userId: 'A', amount: 70 },
        { userId: 'B', amount: 30 },
      ];

      const result = context.executeSplit(totalAmount, participants, exactAmounts);

      expect(result).toContainEqual({ userId: 'A', amountOwed: 70 });
      expect(result).toContainEqual({ userId: 'B', amountOwed: 30 });
    });

    it('should throw an error if exact amounts do not sum to total', () => {
      const strategy = new ExactSplitStrategy();
      const context = new SplitContext(strategy);

      const totalAmount = 100;
      const participants = ['A', 'B'];
      const exactAmounts = [
        { userId: 'A', amount: 70 },
        { userId: 'B', amount: 20 },
      ];

      expect(() => {
        context.executeSplit(totalAmount, participants, exactAmounts);
      }).toThrow(BadRequestException);
    });
  });
});
