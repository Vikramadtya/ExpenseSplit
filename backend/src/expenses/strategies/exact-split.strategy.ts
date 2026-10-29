import { BadRequestException, Injectable } from '@nestjs/common';
import { Money } from '../../common/money/money';
import { OwedAmount, SplitInput, SplitStrategy } from './split.strategy';

@Injectable()
export class ExactSplitStrategy implements SplitStrategy {
  readonly type = 'EXACT' as const;

  allocate(total: Money, { exactAmounts }: SplitInput): OwedAmount[] {
    if (!exactAmounts?.length) throw new BadRequestException('Exact amounts must be provided');
    if (new Set(exactAmounts.map((e) => e.userId)).size !== exactAmounts.length) {
      throw new BadRequestException('Duplicate participants');
    }

    const owed = exactAmounts.map((e) => ({
      userId: e.userId,
      owed: Money.fromMajor(e.amount, total.currency),
    }));
    if (owed.some((o) => o.owed.minor < 0)) {
      throw new BadRequestException('Exact amounts must not be negative');
    }
    const sum = owed.reduce((acc, o) => acc.add(o.owed), Money.zero(total.currency));
    if (!sum.equals(total)) {
      throw new BadRequestException(
        `Exact amounts sum to ${sum.toDecimal()}, expected ${total.toDecimal()}`,
      );
    }
    return owed;
  }
}
