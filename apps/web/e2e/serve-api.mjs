// Starts the real API for the end-to-end tests on a database that is rebuilt from nothing every run:
// drop, create, migrate, then create the first company and Owner with the real bootstrap command.
// Run with the API package as the working directory (see playwright.config.ts).
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../api/package.json', import.meta.url));
const pg = require('pg');

const E2E_DB = 'smartpack_e2e';
const adminUrl = process.env.TEST_DATABASE_URL;
if (!adminUrl) {
  console.error('TEST_DATABASE_URL is not set. See docs/DEVELOPMENT_SETUP.md.');
  process.exit(1);
}
const e2eUrl = new URL(adminUrl);
e2eUrl.pathname = `/${E2E_DB}`;

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`drop database if exists ${E2E_DB} with (force)`);
await admin.query(`create database ${E2E_DB}`);
await admin.end();

const env = {
  ...process.env,
  DATABASE_URL: e2eUrl.toString(),
  DATABASE_SSL: 'disable',
  ARGON2_MEMORY_KIB: '1024',
  ARGON2_TIME_COST: '1',
};

function step(args, extra = {}) {
  const result = spawnSync('node', args, { env: { ...env, ...extra }, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

step(['dist/database/migrate.js']);
step(
  [
    'dist/cli/bootstrap.js',
    '--organization-name',
    process.env.E2E_ORG_NAME,
    '--owner-email',
    process.env.E2E_OWNER_EMAIL,
    '--owner-first-name',
    'Ada',
    '--owner-last-name',
    'Okafor',
    '--email-verified',
  ],
  { BOOTSTRAP_OWNER_PASSWORD: process.env.E2E_OWNER_PASSWORD },
);

const server = spawn('node', ['dist/main.js'], { env, stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
