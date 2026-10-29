import { BadRequestException, Injectable } from '@nestjs/common';
import { Money } from '../../common/money/money';
import { SplitInput, SplitStrategy } from './split.strategy';
import { allocateByWeight } from './weighted';

@Injectable()
export class EqualSplitStrategy implements SplitStrategy {
  readonly type = 'EQUAL' as const;

  allocate(total: Money, { participants }: SplitInput) {
    if (!participants?.length) throw new BadRequestException('Participants must be provided');
    return allocateByWeight(
      total,
      participants.map((userId) => ({ userId, weight: 1 })),
    );
  }
}
