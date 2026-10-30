#!/usr/bin/env node
// Applies pending database migrations and says plainly what happened. (drizzle-kit's own
// `migrate` hides errors behind a spinner and can exit without a result.)
//   DATABASE_URL=... node scripts/migrate.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL first.');
  process.exit(1);
}
const folder = join(dirname(fileURLToPath(import.meta.url)), '../drizzle');
const total = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8')).entries.length;

const sql = postgres(url, { max: 1, onnotice: () => {} });
const applied = async () => {
  const [{ t }] = await sql`SELECT to_regclass('drizzle.__drizzle_migrations') AS t`;
  return t ? (await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`)[0].n : 0;
};

try {
  const before = await applied();
  console.log(`${before} of ${total} migrations already applied.`);
  await migrate(drizzle(sql), { migrationsFolder: folder });
  const after = await applied();
  console.log(after === total ? `Done: all ${total} migrations are applied.` : `Finished, but only ${after} of ${total} are recorded. Something is off.`);
  process.exitCode = after === total ? 0 : 1;
} catch (err) {
  console.error('\nMIGRATION FAILED (nothing from the failing migration was kept):');
  console.error(' ', err?.cause?.message ?? err?.message ?? err);
  if (err?.cause?.detail) console.error('  detail:', err.cause.detail);
  console.error(`  ${await applied().catch(() => '?')} of ${total} migrations are applied.`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
