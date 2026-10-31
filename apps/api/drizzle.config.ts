import { defineConfig } from 'drizzle-kit';

/**
 * Used by `drizzle-kit generate` only. It reads the TypeScript schema and writes SQL files;
 * it never connects to a database, so no credentials are configured here. Migrations are
 * applied by `src/database/migrate.ts`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
});
