import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { DatabaseConfig } from '../config/app-config.js';
import { createPool } from './pool.js';

/** SQL migrations live beside `dist/`, so they ship with the repository, not the build output. */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

/**
 * Applies every pending migration, in order, and closes its connection.
 * Safe to run repeatedly: already-applied migrations are skipped.
 */
export async function runMigrations(config: DatabaseConfig): Promise<void> {
  const pool = createPool(config, 'smartpack-migrate');
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}
