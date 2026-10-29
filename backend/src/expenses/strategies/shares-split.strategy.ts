import { BadRequestException, Injectable } from '@nestjs/common';
import { Money } from '../../common/money/money';
import { SplitInput, SplitStrategy } from './split.strategy';
import { allocateByWeight } from './weighted';

@Injectable()
export class SharesSplitStrategy implements SplitStrategy {
  readonly type = 'SHARES' as const;

  allocate(total: Money, { shares }: SplitInput) {
    if (!shares?.length) throw new BadRequestException('Shares must be provided');
    return allocateByWeight(
      total,
      shares.map((s) => ({ userId: s.userId, weight: s.shares })),
    );
  }
}
