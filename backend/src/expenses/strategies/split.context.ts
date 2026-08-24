import { SplitStrategy, SplitResult } from './split.strategy';

export class SplitContext {
  private strategy: SplitStrategy;

  constructor(strategy: SplitStrategy) {
    this.strategy = strategy;
  }

  public setStrategy(strategy: SplitStrategy) {
    this.strategy = strategy;
  }

  public executeSplit(
    totalAmount: number,
    participants: string[],
    exactAmounts?: { userId: string; amount: number }[],
  ): SplitResult[] {
    return this.strategy.calculateSplits(totalAmount, participants, exactAmounts);
  }
}
