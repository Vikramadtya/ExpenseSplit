export interface SplitResult {
  userId: string;
  amountOwed: number;
}

export interface SplitStrategyOptions {
  exactAmounts?: { userId: string; amount: number }[];
  percentages?: { userId: string; percentage: number }[];
}

export interface SplitStrategy {
  calculateSplits(
    totalAmount: number,
    participants: string[],
    options?: SplitStrategyOptions,
  ): SplitResult[];
}
