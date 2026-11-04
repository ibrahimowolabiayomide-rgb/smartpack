// Latency baseline for the API. Measures a running API process over real HTTP; nothing is mocked.
//
//   PERF_API_URL    API base including /api/v1       (default http://127.0.0.1:4000/api/v1)
//   PERF_ORIGIN     an allowed web origin             (default http://127.0.0.1:3000)
//   PERF_EMAIL      an existing account's address     (required)
//   PERF_PASSWORD   its password, from the environment (required; never put it on the command line)
//
// Run it against a throwaway database with RATE_LIMIT_DISABLED=true on the API (it signs in
// repeatedly). Do not point it at production: it creates sessions and audit rows.
const B = process.env.PERF_API_URL ?? 'http://127.0.0.1:4000/api/v1';
const O = {
  origin: process.env.PERF_ORIGIN ?? 'http://127.0.0.1:3000',
  'content-type': 'application/json',
};
const EMAIL = process.env.PERF_EMAIL;
const PW = process.env.PERF_PASSWORD;
if (!EMAIL || !PW) {
  console.error('Set PERF_EMAIL and PERF_PASSWORD.');
  process.exit(2);
}
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
const stats = (ms) => {
  const s = [...ms].sort((a, b) => a - b);
  return {
    n: s.length,
    p50: +pct(s, 50).toFixed(1),
    p95: +pct(s, 95).toFixed(1),
    p99: +pct(s, 99).toFixed(1),
    max: +s.at(-1).toFixed(1),
  };
};
async function time(fn) {
  const t = performance.now();
  const r = await fn();
  return [performance.now() - t, r];
}

const login = await fetch(`${B}/auth/login`, {
  method: 'POST',
  headers: O,
  body: JSON.stringify({ email: EMAIL, password: PW }),
});
const cookie = login.headers.get('set-cookie').split(';')[0];
const auth = { cookie };

async function sequential(name, n, make) {
  const ms = [];
  for (let i = 0; i < n; i++) {
    const [d, r] = await time(make);
    if (!r.ok && r.status !== 401) throw new Error(`${name}: ${r.status}`);
    await r.arrayBuffer();
    ms.push(d);
  }
  return { name, mode: 'sequential', ...stats(ms) };
}
async function concurrent(name, total, conc, make) {
  const ms = [];
  let next = 0;
  const t0 = performance.now();
  await Promise.all(
    Array.from({ length: conc }, async () => {
      while (next < total) {
        next++;
        const [d, r] = await time(make);
        await r.arrayBuffer();
        if (!r.ok) throw new Error(`${name}: ${r.status}`);
        ms.push(d);
      }
    }),
  );
  const secs = (performance.now() - t0) / 1000;
  return { name, mode: `${conc} concurrent`, ...stats(ms), reqPerSec: +(total / secs).toFixed(0) };
}
const get = (path) => () => fetch(`${B}${path}`, { headers: auth });
const rows = [];
rows.push(await sequential('GET /health (no auth)', 300, () => fetch(`${B}/health`)));
rows.push(await sequential('GET /auth/me (session lookup)', 300, get('/auth/me')));
rows.push(
  await sequential(
    'GET /organizations/current/members',
    200,
    get('/organizations/current/members'),
  ),
);
rows.push(
  await sequential(
    'GET /organizations/current/audit-logs?limit=50 (first page)',
    200,
    get('/organizations/current/audit-logs?limit=50'),
  ),
);
rows.push(
  await sequential('POST /auth/login (Argon2id verify, 19 MiB t=2)', 40, () =>
    fetch(`${B}/auth/login`, {
      method: 'POST',
      headers: O,
      body: JSON.stringify({ email: EMAIL, password: PW }),
    }),
  ),
);
rows.push(await concurrent('GET /auth/me', 2000, 10, get('/auth/me')));
rows.push(await concurrent('GET /auth/me', 2000, 50, get('/auth/me')));
rows.push(
  await concurrent('POST /auth/login (Argon2id)', 60, 8, () =>
    fetch(`${B}/auth/login`, {
      method: 'POST',
      headers: O,
      body: JSON.stringify({ email: EMAIL, password: PW }),
    }),
  ),
);
console.table(rows);
