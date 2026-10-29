import { BadRequestException, Injectable } from '@nestjs/common';
import { Money } from '../../common/money/money';
import { SplitInput, SplitStrategy } from './split.strategy';
import { allocateByWeight } from './weighted';

@Injectable()
export class PercentageSplitStrategy implements SplitStrategy {
  readonly type = 'PERCENTAGE' as const;

  allocate(total: Money, { percentages }: SplitInput) {
    if (!percentages?.length) throw new BadRequestException('Percentages must be provided');
    const sum = percentages.reduce((acc, p) => acc + p.percentage, 0);
    if (Math.abs(sum - 100) > 0.01) {
      throw new BadRequestException(`Percentages sum to ${sum}%, expected 100%`);
    }
    return allocateByWeight(
      total,
      percentages.map((p) => ({ userId: p.userId, weight: p.percentage })),
    );
  }
}
