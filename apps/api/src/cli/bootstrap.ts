import { parseArgs } from 'node:util';
import { drizzle } from 'drizzle-orm/node-postgres';
import { argumentsToParse } from './arguments.js';
import { BootstrapError, provisionFirstOwner } from '../bootstrap/bootstrap.service.js';
import { ConfigError, loadConfig } from '../config/app-config.js';
import { createPool } from '../database/pool.js';
import { summariseDatabaseError } from '../database/error-summary.js';
import * as schema from '../database/schema/index.js';
import { PasswordHasher } from '../security/password-hasher.js';

const USAGE = `Usage: pnpm --filter @smartpack/api bootstrap [options]

Creates the first company and its Owner on an empty installation.

Required:
  --organization-name <name>
  --owner-email <email>
  --owner-first-name <name>
  --owner-last-name <name>

Optional:
  --organization-slug <slug>   Derived from the name when omitted.
  --time-zone <IANA zone>      Default UTC.
  --country <ISO 3166-1 alpha-2>
  --email-verified             Attest that you control the owner's mailbox.

Password (never a command-line argument, so it cannot leak into shell history or process lists):
  - set BOOTSTRAP_OWNER_PASSWORD in the environment, or
  - pass --password-stdin and pipe it in, or
  - type it at the hidden prompt when run in a terminal.
`;

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

function promptHidden(label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(
        new Error(
          'No terminal for the password prompt. Use BOOTSTRAP_OWNER_PASSWORD or --password-stdin.',
        ),
      );
      return;
    }
    process.stdout.write(label);
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (char: string): void => {
      for (const c of char) {
        if (c === '\r' || c === '\n' || c === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (c === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on('data', onData);
  });
}

async function readPassword(fromStdin: boolean): Promise<string> {
  if (fromStdin) return (await readStdin()).replace(/\r?\n$/, '');
  const fromEnv = process.env.BOOTSTRAP_OWNER_PASSWORD;
  if (fromEnv) return fromEnv;
  const first = await promptHidden('Owner password: ');
  const second = await promptHidden('Repeat password: ');
  if (first !== second) throw new BootstrapError('invalid_input', 'The passwords do not match.');
  return first;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: argumentsToParse(process.argv.slice(2)),
    options: {
      'organization-name': { type: 'string' },
      'organization-slug': { type: 'string' },
      'time-zone': { type: 'string' },
      country: { type: 'string' },
      'owner-email': { type: 'string' },
      'owner-first-name': { type: 'string' },
      'owner-last-name': { type: 'string' },
      'email-verified': { type: 'boolean' },
      'password-stdin': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }
  const required = [
    'organization-name',
    'owner-email',
    'owner-first-name',
    'owner-last-name',
  ] as const;
  const missing = required.filter((key) => !values[key]);
  if (missing.length > 0) {
    process.stderr.write(`Missing: ${missing.map((m) => `--${m}`).join(', ')}\n\n${USAGE}`);
    process.exit(2);
  }

  const config = loadConfig(process.env);
  const password = await readPassword(values['password-stdin'] === true);
  const pool = createPool(config.database, `smartpack-bootstrap/${config.version}`);
  try {
    const result = await provisionFirstOwner(
      drizzle(pool, { schema }),
      new PasswordHasher(config),
      {
        organizationName: values['organization-name'] ?? '',
        organizationSlug: values['organization-slug'],
        timeZone: values['time-zone'],
        country: values.country,
        ownerEmail: values['owner-email'] ?? '',
        ownerFirstName: values['owner-first-name'] ?? '',
        ownerLastName: values['owner-last-name'] ?? '',
        password,
        emailVerified: values['email-verified'] === true,
      },
    );
    process.stdout.write(
      `Created organization "${result.organizationSlug}" (${result.organizationId}) ` +
        `with owner ${result.ownerEmail}.\n`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof BootstrapError || error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error instanceof BootstrapError && error.reason === 'invalid_input' ? 2 : 1);
  }
  // Never print the raw error: it can embed connection details.
  process.stderr.write(`Bootstrap failed: ${summariseDatabaseError(error)}\n`);
  process.exit(1);
});
