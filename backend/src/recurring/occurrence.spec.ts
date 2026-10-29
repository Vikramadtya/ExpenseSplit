import { occurrenceAt } from './occurrence';

const d = (iso: string) => new Date(iso);

describe('occurrenceAt', () => {
  it('steps daily and weekly', () => {
    expect(occurrenceAt(d('2026-01-01T10:00:00Z'), 'DAILY', 3).toISOString()).toBe(
      '2026-01-04T10:00:00.000Z',
    );
    expect(occurrenceAt(d('2026-01-01T10:00:00Z'), 'WEEKLY', 2).toISOString()).toBe(
      '2026-01-15T10:00:00.000Z',
    );
  });

  it('keeps the original day of month, clamping short months without drifting', () => {
    const start = d('2026-01-31T09:00:00Z');
    const days = [0, 1, 2, 3].map((n) =>
      occurrenceAt(start, 'MONTHLY', n).toISOString().slice(0, 10),
    );
    expect(days).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('handles leap years and year rollover', () => {
    expect(occurrenceAt(d('2028-01-31T00:00:00Z'), 'MONTHLY', 1).toISOString().slice(0, 10)).toBe(
      '2028-02-29',
    );
    expect(occurrenceAt(d('2026-11-15T00:00:00Z'), 'MONTHLY', 3).toISOString().slice(0, 10)).toBe(
      '2027-02-15',
    );
    expect(occurrenceAt(d('2026-12-10T00:00:00Z'), 'MONTHLY', 14).toISOString().slice(0, 10)).toBe(
      '2028-02-10',
    );
  });

  it('returns the start for n = 0', () => {
    expect(occurrenceAt(d('2026-05-05T05:05:05Z'), 'MONTHLY', 0).toISOString()).toBe(
      '2026-05-05T05:05:05.000Z',
    );
  });
});
