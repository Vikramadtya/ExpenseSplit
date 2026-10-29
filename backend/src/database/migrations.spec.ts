import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(__dirname, '../../drizzle');

describe('migrations', () => {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.replace(/\.sql$/, ''))
    .sort();
  const journal: { entries: { idx: number; tag: string; when: number }[] } = JSON.parse(
    readFileSync(join(dir, 'meta/_journal.json'), 'utf8'),
  );

  // drizzle-kit migrate silently skips any .sql file that is missing from the journal.
  it('lists every migration file in the journal, in order', () => {
    expect(journal.entries.map((e) => e.tag)).toEqual(files);
    journal.entries.forEach((e, i) => expect(e.idx).toBe(i));
  });

  it('has a snapshot for every migration', () => {
    const snapshots = readdirSync(join(dir, 'meta')).filter((f) => f.endsWith('_snapshot.json'));
    expect(snapshots).toHaveLength(files.length);
  });

  it('applies migrations in increasing time order', () => {
    const times = journal.entries.map((e) => e.when);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});
