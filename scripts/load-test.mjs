// Load-tests the redirect endpoint: creates one short link, then requests it
// as fast as possible and reports throughput and latency.
//
// Usage: npm run load-test -- [baseUrl] [durationSeconds]
import autocannon from 'autocannon';

const baseUrl = process.argv[2] ?? 'http://localhost:3000';
const duration = Number(process.argv[3] ?? 20);
const connections = 50;

const res = await fetch(`${baseUrl}/links`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com/load-test' }),
});
if (!res.ok) {
  throw new Error(`Creating the link failed: ${res.status} ${await res.text()}`);
}
const { code } = await res.json();

console.log(
  `Redirecting ${baseUrl}/${code} with ${connections} connections for ${duration}s...`,
);
// autocannon doesn't follow redirects, so this measures only our 302.
const result = await autocannon({
  url: `${baseUrl}/${code}`,
  connections,
  duration,
});

const redirects = result.statusCodeStats['302']?.count ?? 0;
console.table({
  'requests/s (avg)': Math.round(result.requests.average),
  'latency p50 (ms)': result.latency.p50,
  'latency p90 (ms)': result.latency.p90,
  'latency p99 (ms)': result.latency.p99,
  'total requests': result.requests.total,
  '302 responses': redirects,
  errors: result.errors + result.timeouts,
});
