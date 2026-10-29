import { BadRequestException } from '@nestjs/common';
import { Money } from '../common/money/money';
import { buildSplitRows } from './split-builder';

const usd = (n: number) => Money.fromMajor(n, 'USD');

describe('buildSplitRows', () => {
  it('merges owed and paid, including payers who owe nothing', () => {
    const rows = buildSplitRows(
      usd(30),
      [
        { userId: 'a', owed: usd(15) },
        { userId: 'b', owed: usd(15) },
      ],
      [{ userId: 'c', amount: 30 }],
    );
    const byUser = Object.fromEntries(rows.map((r) => [r.userId, [r.owed.minor, r.paid.minor]]));
    expect(byUser).toEqual({ a: [1500, 0], b: [1500, 0], c: [0, 3000] });
  });

  it('supports several payers', () => {
    const rows = buildSplitRows(
      usd(30),
      [
        { userId: 'a', owed: usd(15) },
        { userId: 'b', owed: usd(15) },
      ],
      [
        { userId: 'a', amount: 20 },
        { userId: 'b', amount: 10 },
      ],
    );
    expect(rows.map((r) => r.paid.minor)).toEqual([2000, 1000]);
  });

  it('rejects payers that do not add up to the total', () => {
    expect(() =>
      buildSplitRows(usd(30), [{ userId: 'a', owed: usd(30) }], [{ userId: 'a', amount: 25 }]),
    ).toThrow(BadRequestException);
  });
});
