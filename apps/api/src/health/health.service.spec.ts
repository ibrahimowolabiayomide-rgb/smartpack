import { describe, expect, it } from '@jest/globals';
import { healthReportSchema } from '@smartpack/shared';
import type { AppConfig } from '../config/app-config.js';
import type { DatabaseProbe, DatabaseService } from '../database/database.service.js';
import { HealthService, overallStatus } from './health.service.js';

const config: AppConfig = {
  env: 'test',
  isProduction: false,
  host: '127.0.0.1',
  port: 4000,
  logLevel: 'silent',
  version: '1.2.3',
  cors: { allowedOrigins: [] },
  docs: { enabled: false },
  database: {
    url: 'postgresql://unused@localhost:5432/unused',
    ssl: 'disable',
    poolMax: 1,
    connectionTimeoutMs: 1000,
    queryTimeoutMs: 1000,
  },
};

function serviceWith(probe: DatabaseProbe): HealthService {
  const database = { probe: () => Promise.resolve(probe) } as unknown as DatabaseService;
  return new HealthService(config, database);
}

describe('overallStatus', () => {
  it('is ok only when the database is up and PostGIS is enabled', () => {
    expect(overallStatus({ status: 'up', latencyMs: 2, postgis: 'enabled' })).toBe('ok');
  });

  it('is degraded when the database answers but PostGIS is missing', () => {
    expect(overallStatus({ status: 'up', latencyMs: 2, postgis: 'missing' })).toBe('degraded');
  });

  it('is error when the database is down, whatever else is reported', () => {
    expect(overallStatus({ status: 'down', latencyMs: null, postgis: 'unknown' })).toBe('error');
    expect(overallStatus({ status: 'down', latencyMs: null, postgis: 'enabled' })).toBe('error');
  });
});

describe('HealthService.check', () => {
  it('builds a contract-valid report from the probe result', async () => {
    const report = await serviceWith({ status: 'up', latencyMs: 4, postgis: 'enabled' }).check();
    expect(healthReportSchema.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({
      status: 'ok',
      service: 'smartpack-api',
      version: '1.2.3',
      environment: 'test',
      checks: { database: { status: 'up', latencyMs: 4 }, postgis: { status: 'enabled' } },
    });
  });

  it('reports a down database as down with no latency', async () => {
    const report = await serviceWith({
      status: 'down',
      latencyMs: null,
      postgis: 'unknown',
    }).check();
    expect(report.status).toBe('error');
    expect(report.checks.database).toEqual({ status: 'down', latencyMs: null });
    expect(report.checks.postgis.status).toBe('unknown');
  });
});
