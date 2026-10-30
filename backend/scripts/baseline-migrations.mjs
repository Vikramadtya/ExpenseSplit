#!/usr/bin/env node
// One-time helper for a database that was created with `drizzle-kit push` (so it has the tables
// but no migration history). It records the baseline migration (0000) as already applied, so that
// `npm run db:migrate` only runs the newer ones.
//
//   DATABASE_URL=... node scripts/baseline-migrations.mjs          # shows what it would do
//   DATABASE_URL=... node scripts/baseline-migrations.mjs --apply  # does it
//
// Safe to run twice. It refuses to act unless the baseline tables are really there.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL to the database you want to baseline.');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const dir = join(dirname(fileURLToPath(import.meta.url)), '../drizzle');
const journal = JSON.parse(readFileSync(join(dir, 'meta/_journal.json'), 'utf8'));
const baseline = journal.entries[0];
const sqlText = readFileSync(join(dir, `${baseline.tag}.sql`), 'utf8');
// Same hash and timestamp drizzle itself records when it applies a migration.
const hash = createHash('sha256').update(sqlText).digest('hex');
const expectedTables = [...sqlText.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]);

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const tables = new Set(
    (await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`).map((r) => r.table_name),
  );
  const history = await sql`SELECT to_regclass('drizzle.__drizzle_migrations') AS t`;

  if (history[0].t) {
    const rows = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
    if (rows[0].n > 0) {
      console.log(`Migration history already exists (${rows[0].n} applied). Nothing to do: run "npm run db:migrate".`);
      process.exit(0);
    }
  }
  if (!tables.has('users')) {
    console.log('This database is empty (no tables). Nothing to baseline: run "npm run db:migrate" and it builds everything.');
    process.exit(0);
  }
  const missing = expectedTables.filter((t) => !tables.has(t));
  if (missing.length > 0) {
    console.error(`Cannot baseline: these baseline tables are missing: ${missing.join(', ')}.`);
    console.error('The database does not match the baseline schema, so marking it as applied would be wrong.');
    process.exit(2);
  }

  console.log(`Found the ${expectedTables.length} baseline tables but no migration history.`);
  console.log(`Will record ${baseline.tag} (${hash.slice(0, 12)}…) as already applied.`);
  if (!apply) {
    console.log('Dry run. Re-run with --apply to do it.');
    process.exit(0);
  }
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`;
  await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${baseline.when})`;
  console.log('Done. Now run "npm run db:migrate" to apply the newer migrations.');
} finally {
  await sql.end();
}
