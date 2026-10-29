import { Money } from '../../common/money/money';

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES' | 'ITEMIZED';

export interface SplitInput {
  participants?: string[];
  exactAmounts?: { userId: string; amount: number }[];
  percentages?: { userId: string; percentage: number }[];
  shares?: { userId: string; shares: number }[];
  /** ITEMIZED: each line is split equally between the people it is assigned to. */
  items?: { name: string; amount: number; assignees: string[] }[];
  /** ITEMIZED: shared out in proportion to what each person's items came to. */
  tax?: number;
  tip?: number;
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
