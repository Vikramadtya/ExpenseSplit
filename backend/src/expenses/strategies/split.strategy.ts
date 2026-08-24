export interface SplitResult {
  userId: string;
  amountOwed: number;
}

export interface SplitStrategy {
  calculateSplits(
    totalAmount: number,
    participants: string[],
    exactAmounts?: { userId: string; amount: number }[],
  ): SplitResult[];
}
