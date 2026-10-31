import pg from 'pg';
import type { DatabaseConfig } from '../config/app-config.js';

const { Pool } = pg;

function sslOption(mode: DatabaseConfig['ssl']): pg.PoolConfig['ssl'] {
  switch (mode) {
    case 'disable':
      return false;
    case 'require':
      return { rejectUnauthorized: true };
    case 'no-verify':
      // Encrypts the connection without verifying the server certificate. Exposed only so a
      // provider with a private CA can be used temporarily; documented as discouraged.
      return { rejectUnauthorized: false };
  }
}

/**
 * Creates a connection pool. No connection is opened until the first query, so constructing
 * a pool never throws because the database is down.
 */
export function createPool(config: DatabaseConfig, applicationName: string): pg.Pool {
  return new Pool({
    connectionString: config.url,
    ssl: sslOption(config.ssl),
    max: config.poolMax,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    // Client-side and server-side limits: a hung query must not pin a connection forever.
    query_timeout: config.queryTimeoutMs,
    statement_timeout: config.queryTimeoutMs,
    application_name: applicationName,
  });
}
