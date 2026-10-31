import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import { APP_CONFIG } from '../config/config.constants.js';
import type { AppConfig } from '../config/app-config.js';
import { summariseDatabaseError } from './error-summary.js';
import { createPool } from './pool.js';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseProbe {
  status: 'up' | 'down';
  latencyMs: number | null;
  postgis: 'enabled' | 'missing' | 'unknown';
}

const PROBE_TIMEOUT_MS = 3_000;

class ProbeTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Database probe timed out after ${timeoutMs} ms`);
    this.name = 'ProbeTimeoutError';
  }
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ProbeTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: pg.Pool;
  readonly db: Database;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.pool = createPool(config.database, `smartpack-api/${config.version}`);
    // An idle client can error (server restart, network drop). Without a listener Node treats
    // the pool's 'error' event as uncaught and the process exits.
    this.pool.on('error', (error) => {
      this.logger.error(`Idle database client error: ${summariseDatabaseError(error)}`);
    });
    this.db = drizzle(this.pool, { schema });
  }

  /**
   * Runs a real query against the database and reports whether it answered.
   * Never throws: a failure is reported as `down`, and details go to the server log only.
   */
  async probe(timeoutMs: number = PROBE_TIMEOUT_MS): Promise<DatabaseProbe> {
    const started = performance.now();
    try {
      const result = await withTimeout(
        this.db.execute<{ postgis: boolean }>(
          sql`select exists (select 1 from pg_extension where extname = 'postgis') as postgis`,
        ),
        timeoutMs,
      );
      const row = result.rows[0];
      return {
        status: 'up',
        latencyMs: Math.round(performance.now() - started),
        postgis: row?.postgis === true ? 'enabled' : 'missing',
      };
    } catch (error) {
      this.logger.warn(`Database probe failed: ${summariseDatabaseError(error)}`);
      return { status: 'down', latencyMs: null, postgis: 'unknown' };
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
