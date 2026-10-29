#!/usr/bin/env node
// Closed-loop load test: N workers hit each endpoint for a few seconds, then it prints latency
// percentiles. Usage: node scripts/bench.mjs <apiBase> <jwt> <workspaceId> [concurrency=20] [seconds=8]
// Run the API with THROTTLE_LIMIT set very high, or the rate limiter will answer instead of the app.
const [base, token, workspaceId, concurrencyArg, secondsArg] = process.argv.slice(2);
if (!base || !token || !workspaceId) {
  console.error('usage: bench.mjs <apiBase> <jwt> <workspaceId> [concurrency] [seconds]');
  process.exit(1);
}
const concurrency = Number(concurrencyArg ?? 20);
const seconds = Number(secondsArg ?? 8);
const headers = { Authorization: `Bearer ${token}` };
const w = `/workspaces/${workspaceId}`;

const endpoints = [
  ['expenses (page of 50)', `${w}/expenses?limit=50`],
  ['expenses (search)', `${w}/expenses?q=expense%2012&limit=50`],
  ['expenses (tag filter)', `${w}/expenses?tags=t3&limit=50`],
  ['balances', `${w}/balances`],
  ['debts (simplified)', `${w}/balances/debts`],
  ['debts (pairwise)', `${w}/balances/debts?simplified=false`],
  ['analytics', `${w}/analytics?groupBy=month`],
  ['friends balances', '/balances/friends'],
  ['members', `${w}/members`],
];

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function run([name, path]) {
  const latencies = [];
  let errors = 0;
  const stopAt = Date.now() + seconds * 1000;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (Date.now() < stopAt) {
        const start = performance.now();
        try {
          const res = await fetch(base + path, { headers });
          await res.arrayBuffer();
          if (!res.ok) errors++;
        } catch {
          errors++;
        }
        latencies.push(performance.now() - start);
      }
    }),
  );
  latencies.sort((a, b) => a - b);
  return {
    endpoint: name,
    requests: latencies.length,
    'req/s': Math.round(latencies.length / seconds),
    'p50 ms': Math.round(percentile(latencies, 50)),
    'p95 ms': Math.round(percentile(latencies, 95)),
    'p99 ms': Math.round(percentile(latencies, 99)),
    errors,
  };
}

console.log(`concurrency ${concurrency}, ${seconds}s per endpoint`);
const rows = [];
for (const endpoint of endpoints) rows.push(await run(endpoint));
console.table(rows);
