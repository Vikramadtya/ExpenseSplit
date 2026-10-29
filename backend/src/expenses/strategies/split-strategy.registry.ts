import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SPLIT_STRATEGIES, SplitStrategy, SplitType } from './split.strategy';

/** Open/closed: supporting a new split type means registering one more strategy provider. */
@Injectable()
export class SplitStrategyRegistry {
  private readonly byType: Map<SplitType, SplitStrategy>;

  constructor(@Inject(SPLIT_STRATEGIES) strategies: SplitStrategy[]) {
    this.byType = new Map(strategies.map((s) => [s.type, s]));
  }

  get(type: SplitType): SplitStrategy {
    const strategy = this.byType.get(type);
    if (!strategy) throw new BadRequestException(`Unsupported split type: ${type}`);
    return strategy;
  }
}
