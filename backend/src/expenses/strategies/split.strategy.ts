import { Money } from '../../common/money/money';

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';

export interface SplitInput {
  participants?: string[];
  exactAmounts?: { userId: string; amount: number }[];
  percentages?: { userId: string; percentage: number }[];
  shares?: { userId: string; shares: number }[];
}

export interface OwedAmount {
  userId: string;
  owed: Money;
}

/** Decides how much of an expense each person owes. One implementation per split type. */
export interface SplitStrategy {
  readonly type: SplitType;
  allocate(total: Money, input: SplitInput): OwedAmount[];
}

export const SPLIT_STRATEGIES = Symbol('SPLIT_STRATEGIES');
