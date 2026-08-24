import { SplitStrategy, SplitResult } from './split.strategy';

export class EqualSplitStrategy implements SplitStrategy {
  calculateSplits(totalAmount: number, participants: string[]): SplitResult[] {
    if (participants.length === 0) return [];

    const count = participants.length;
    // Calculate precise float base amount
    const baseAmount = totalAmount / count;
    // Round to 2 decimal places to get realistic currency values
    const roundedAmount = Math.round(baseAmount * 100) / 100;

    const currentTotal = roundedAmount * count;
    // Calculate the difference due to rounding (e.g. 100 / 3 = 33.33 * 3 = 99.99, difference is 0.01)
    let remainder = Math.round((totalAmount - currentTotal) * 100) / 100;

    return participants.map((userId) => {
      let finalAmount = roundedAmount;

      // Distribute the remainder iteratively (1 cent at a time)
      if (remainder > 0) {
        finalAmount += 0.01;
        remainder -= 0.01;
      } else if (remainder < 0) {
        finalAmount -= 0.01;
        remainder += 0.01;
      }

      return {
        userId,
        amountOwed: Math.round(finalAmount * 100) / 100,
      };
    });
  }
}
