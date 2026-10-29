export type RecurringInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The n-th occurrence of a series that starts at `start` (n = 0 is the start itself).
 * Monthly series keep their original day: Jan 31 -> Feb 28 -> Mar 31, never drifting to the 28th.
 */
export function occurrenceAt(start: Date, interval: RecurringInterval, n: number): Date {
  if (interval === 'DAILY') return new Date(start.getTime() + n * DAY_MS);
  if (interval === 'WEEKLY') return new Date(start.getTime() + n * 7 * DAY_MS);

  const monthIndex = start.getUTCMonth() + n;
  const year = start.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(start.getUTCDate(), daysInMonth),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds(),
    ),
  );
}
