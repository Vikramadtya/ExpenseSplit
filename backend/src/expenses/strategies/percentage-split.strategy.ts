import { SplitStrategy, SplitResult, SplitStrategyOptions } from './split.strategy';
import { BadRequestException } from '@nestjs/common';

export class PercentageSplitStrategy implements SplitStrategy {
  calculateSplits(
    totalAmount: number,
    participants: string[],
    options?: SplitStrategyOptions,
  ): SplitResult[] {
    const percentages = options?.percentages;
    if (!percentages || percentages.length === 0) {
      throw new BadRequestException('Percentages must be provided for a percentage split.');
    }

    // Verify all participants have a specified percentage
    const providedUserIds = new Set(percentages.map((p) => p.userId));
    for (const p of participants) {
      if (!providedUserIds.has(p)) {
        throw new BadRequestException(`Participant ${p} is missing a percentage specification.`);
      }
    }

    const sum = percentages.reduce((acc, curr) => acc + curr.percentage, 0);
    if (Math.abs(sum - 100) > 0.01) {
      throw new BadRequestException(`Percentages sum (${sum}%) does not equal 100%.`);
    }

    // Calculate amounts and handle floating point remainders
    const splits: SplitResult[] = [];
    let totalAllocated = 0;

    for (let i = 0; i < percentages.length; i++) {
      const p = percentages[i];
      // If it's the last participant, give them the exact remainder to prevent penny rounding errors
      if (i === percentages.length - 1) {
        splits.push({
          userId: p.userId,
          amountOwed: Math.round((totalAmount - totalAllocated) * 100) / 100,
        });
      } else {
        const amount = Math.round(totalAmount * (p.percentage / 100) * 100) / 100;
        totalAllocated += amount;
        splits.push({
          userId: p.userId,
          amountOwed: amount,
        });
      }
    }

    return splits;
  }
}
