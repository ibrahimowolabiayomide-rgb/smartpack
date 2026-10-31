import { ConfigError, loadDatabaseConfig } from '../config/app-config.js';
import { summariseDatabaseError } from './error-summary.js';
import { runMigrations } from './run-migrations.js';

/**
 * Command-line entry point: `pnpm db:migrate`.
 *
 * Deliberately separate from API startup: when several API instances boot at once they would
 * race to migrate, and a schema change should be a visible deployment step, not a side effect
 * of a restart.
 */
async function main(): Promise<void> {
  await runMigrations(loadDatabaseConfig(process.env));
  process.stdout.write('Migrations applied successfully.\n');
}

main().catch((error: unknown) => {
  // ConfigError text is safe by construction. Anything else is reduced to its root cause (code and
  // first message line) because the full error can embed connection details and query text.
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write(`Migration failed: ${summariseDatabaseError(error)}\n`);
  }
  process.exit(1);
});
