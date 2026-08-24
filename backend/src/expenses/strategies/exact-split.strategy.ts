import { SplitStrategy, SplitResult } from './split.strategy';
import { BadRequestException } from '@nestjs/common';

export class ExactSplitStrategy implements SplitStrategy {
  calculateSplits(
    totalAmount: number,
    participants: string[],
    exactAmounts?: { userId: string; amount: number }[],
  ): SplitResult[] {
    if (!exactAmounts || exactAmounts.length === 0) {
      throw new BadRequestException('Exact amounts must be provided for an exact split.');
    }

    // Verify all participants have a specified amount
    const providedUserIds = new Set(exactAmounts.map((ea) => ea.userId));
    for (const p of participants) {
      if (!providedUserIds.has(p)) {
        throw new BadRequestException(`Participant ${p} is missing an exact amount specification.`);
      }
    }

    const sum = exactAmounts.reduce((acc, curr) => acc + curr.amount, 0);
    // Use an epsilon for floating point comparison
    if (Math.abs(sum - totalAmount) > 0.01) {
      throw new BadRequestException(
        `Exact amounts sum (${sum}) does not equal total amount (${totalAmount}).`,
      );
    }

    return exactAmounts.map((ea) => ({
      userId: ea.userId,
      amountOwed: Math.round(ea.amount * 100) / 100,
    }));
  }
}
