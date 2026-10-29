import { BadRequestException } from '@nestjs/common';
import { Money } from '../../common/money/money';
import { EqualSplitStrategy } from './equal-split.strategy';
import { ExactSplitStrategy } from './exact-split.strategy';
import { PercentageSplitStrategy } from './percentage-split.strategy';
import { SharesSplitStrategy } from './shares-split.strategy';
import { ItemizedSplitStrategy } from './itemized-split.strategy';
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

describe('ItemizedSplitStrategy', () => {
  const strategy = new ItemizedSplitStrategy();
  const owed = (r: { userId: string; owed: Money }[]) =>
    Object.fromEntries(r.map((x) => [x.userId, x.owed.minor]));

  it('splits shared items equally and gives tax and tip in proportion to each subtotal', () => {
    // a: pasta 20 + half of the 10 starter = 25; b: salad 10 + half = 15. Subtotal 40, tax 4, tip 6.
    const r = strategy.allocate(usd(50), {
      items: [
        { name: 'Pasta', amount: 20, assignees: ['a'] },
        { name: 'Salad', amount: 10, assignees: ['b'] },
        { name: 'Starter', amount: 10, assignees: ['a', 'b'] },
      ],
      tax: 4,
      tip: 6,
    });
    // extras 10 split 25:15 => a 6.25, b 3.75
    expect(owed(r)).toEqual({ a: 3125, b: 1875 });
    expect(r.reduce((s, x) => s + x.owed.minor, 0)).toBe(5000);
  });

  it('never loses a cent on awkward splits', () => {
    const r = strategy.allocate(usd(10.01), {
      items: [{ name: 'Shared', amount: 10.01, assignees: ['a', 'b', 'c'] }],
    });
    expect(r.reduce((s, x) => s + x.owed.minor, 0)).toBe(1001);
    expect(Object.values(owed(r)).sort()).toEqual([333, 334, 334]);
  });

  it('rejects totals that do not match, unassigned items and duplicate assignees', () => {
    const base = { items: [{ name: 'Tea', amount: 5, assignees: ['a'] }] };
    expect(() => strategy.allocate(usd(6), base)).toThrow(BadRequestException);
    expect(() =>
      strategy.allocate(usd(5), { items: [{ name: 'Tea', amount: 5, assignees: [] }] }),
    ).toThrow(BadRequestException);
    expect(() =>
      strategy.allocate(usd(5), { items: [{ name: 'Tea', amount: 5, assignees: ['a', 'a'] }] }),
    ).toThrow(BadRequestException);
    expect(() => strategy.allocate(usd(5), {})).toThrow(BadRequestException);
  });
});
