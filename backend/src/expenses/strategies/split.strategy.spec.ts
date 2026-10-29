import { BadRequestException } from '@nestjs/common';
import { Money } from '../../common/money/money';
import { EqualSplitStrategy } from './equal-split.strategy';
import { ExactSplitStrategy } from './exact-split.strategy';
import { PercentageSplitStrategy } from './percentage-split.strategy';
import { SharesSplitStrategy } from './shares-split.strategy';
import { SplitStrategyRegistry } from './split-strategy.registry';

const usd = (amount: number) => Money.fromMajor(amount, 'USD');
const minors = (r: { owed: Money }[]) => r.map((x) => x.owed.minor);

describe('split strategies', () => {
  it('equal: spreads the remainder cent by cent', () => {
    const r = new EqualSplitStrategy().allocate(usd(100), { participants: ['a', 'b', 'c'] });
    expect(minors(r)).toEqual([3334, 3333, 3333]);
  });

  it('equal: requires participants', () => {
    expect(() => new EqualSplitStrategy().allocate(usd(10), {})).toThrow(BadRequestException);
  });

  it('exact: accepts amounts that sum to the total', () => {
    const r = new ExactSplitStrategy().allocate(usd(10), {
      exactAmounts: [
        { userId: 'a', amount: 7.5 },
        { userId: 'b', amount: 2.5 },
      ],
    });
    expect(minors(r)).toEqual([750, 250]);
  });

  it('exact: rejects a wrong sum and duplicates', () => {
    const s = new ExactSplitStrategy();
    expect(() => s.allocate(usd(10), { exactAmounts: [{ userId: 'a', amount: 9 }] })).toThrow(
      BadRequestException,
    );
    expect(() =>
      s.allocate(usd(10), {
        exactAmounts: [
          { userId: 'a', amount: 5 },
          { userId: 'a', amount: 5 },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('percentage: allocates exactly with no lost cents', () => {
    const r = new PercentageSplitStrategy().allocate(usd(100), {
      percentages: [
        { userId: 'a', percentage: 33.33 },
        { userId: 'b', percentage: 33.33 },
        { userId: 'c', percentage: 33.34 },
      ],
    });
    expect(minors(r).reduce((a, b) => a + b, 0)).toBe(10000);
    expect(minors(r)).toEqual([3333, 3333, 3334]);
  });

  it('percentage: rejects totals other than 100', () => {
    expect(() =>
      new PercentageSplitStrategy().allocate(usd(10), {
        percentages: [{ userId: 'a', percentage: 50 }],
      }),
    ).toThrow(BadRequestException);
  });

  it('shares: weights by share count', () => {
    const r = new SharesSplitStrategy().allocate(usd(90), {
      shares: [
        { userId: 'a', shares: 2 },
        { userId: 'b', shares: 1 },
      ],
    });
    expect(minors(r)).toEqual([6000, 3000]);
  });

  it('registry resolves by type and rejects unknown types', () => {
    const registry = new SplitStrategyRegistry([new EqualSplitStrategy()]);
    expect(registry.get('EQUAL').type).toBe('EQUAL');
    expect(() => registry.get('SHARES')).toThrow(BadRequestException);
  });
});
