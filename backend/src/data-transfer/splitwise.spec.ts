import { isPayment, parseSplitwiseCsv, toExpenseShape, toPaymentShape } from './splitwise';

const CSV = `Date,Description,Category,Cost,Currency,Ana,Raj,Mia
2026-01-05,"Dinner, with friends",Dining out,90.00,USD,60.00,-30.00,-30.00
2026-01-06,Taxi,Taxi,10.00,USD,-5.00,5.00,0.00
2026-01-07,Payment,Payment,25.00,USD,25.00,-25.00,0.00

2026-01-08,Total balance, ,0.00,USD,0.00,0.00,0.00
`;

describe('parseSplitwiseCsv', () => {
  const parsed = parseSplitwiseCsv(CSV);

  it('reads members, rows and ignores the total row', () => {
    expect(parsed.members).toEqual(['Ana', 'Raj', 'Mia']);
    expect(parsed.rows.map((r) => r.description)).toEqual([
      'Dinner, with friends',
      'Taxi',
      'Payment',
    ]);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toEqual(
      expect.objectContaining({ cost: 90, currency: 'USD', nets: { Ana: 60, Raj: -30, Mia: -30 } }),
    );
  });

  it('reports unreadable rows with their line numbers instead of failing the file', () => {
    const bad = parseSplitwiseCsv(
      'Date,Description,Category,Cost,Currency,A,B\nnot-a-date,x,y,5,USD,1,-1\n2026-01-01,x,y,abc,USD,1,-1\n',
    );
    expect(bad.rows).toEqual([]);
    expect(bad.errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it('refuses files that are not Splitwise exports', () => {
    expect(() => parseSplitwiseCsv('foo,bar\n1,2')).toThrow(/Splitwise/);
  });

  it('spots payment rows', () => {
    expect(parsed.rows.map(isPayment)).toEqual([false, false, true]);
  });
});

describe('toExpenseShape', () => {
  const rows = parseSplitwiseCsv(CSV).rows;

  it('turns one payer into paid and owed amounts that match the cost', () => {
    expect(toExpenseShape(rows[0])).toEqual({
      payers: [{ name: 'Ana', amount: 90 }],
      owed: [
        { name: 'Ana', amount: 30 },
        { name: 'Raj', amount: 30 },
        { name: 'Mia', amount: 30 },
      ],
    });
  });

  it('handles someone who paid and is owed only a part', () => {
    expect(toExpenseShape(rows[1])).toEqual({
      payers: [{ name: 'Raj', amount: 10 }],
      owed: [
        { name: 'Ana', amount: 5 },
        { name: 'Raj', amount: 5 },
      ],
    });
  });

  it('rejects rows that do not balance', () => {
    expect(() => toExpenseShape({ ...rows[0], nets: { Ana: 60, Raj: -10 } })).toThrow(/zero/);
  });

  it('splits payers in proportion to what they are owed, to the cent', () => {
    const shape = toExpenseShape({ ...rows[0], cost: 100, nets: { Ana: 40, Raj: 20, Mia: -60 } });
    expect(shape.payers.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(100, 2);
    expect(shape.owed.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(100, 2);
  });
});

describe('toPaymentShape', () => {
  it('names who paid whom', () => {
    expect(toPaymentShape(parseSplitwiseCsv(CSV).rows[2])).toEqual({ payer: 'Ana', payee: 'Raj' });
  });
  it('rejects payments that are not between two people', () => {
    expect(() => toPaymentShape({ ...parseSplitwiseCsv(CSV).rows[0] })).toThrow(/two people/);
  });
});
