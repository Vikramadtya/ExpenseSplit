import { BadRequestException } from '@nestjs/common';
import { Money } from '../../common/money/money';
import { OwedAmount } from './split.strategy';

/** Shared by every strategy that splits proportionally to a weight per person. */
export function allocateByWeight(
  total: Money,
  entries: { userId: string; weight: number }[],
): OwedAmount[] {
  if (entries.length === 0) throw new BadRequestException('At least one participant is required');
  const ids = new Set(entries.map((e) => e.userId));
  if (ids.size !== entries.length) throw new BadRequestException('Duplicate participants');
  if (entries.some((e) => !(e.weight >= 0))) {
    throw new BadRequestException('Split values must not be negative');
  }
  if (entries.every((e) => e.weight === 0)) {
    throw new BadRequestException('Split values must not all be zero');
  }
  const parts = total.allocate(entries.map((e) => e.weight));
  return entries.map((e, i) => ({ userId: e.userId, owed: parts[i] }));
}
