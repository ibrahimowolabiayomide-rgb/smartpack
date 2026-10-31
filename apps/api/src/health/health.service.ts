import { Inject, Injectable } from '@nestjs/common';
import type { HealthReport, HealthStatus } from '@smartpack/shared';
import type { AppConfig } from '../config/app-config.js';
import { SERVICE_NAME } from '../config/app-info.js';
import { APP_CONFIG } from '../config/config.constants.js';
import { DatabaseService, type DatabaseProbe } from '../database/database.service.js';

export function overallStatus(probe: DatabaseProbe): HealthStatus {
  if (probe.status === 'down') return 'error';
  return probe.postgis === 'enabled' ? 'ok' : 'degraded';
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly database: DatabaseService,
  ) {}

  /** Builds the report from a live database query. Nothing here is cached or assumed. */
  async check(): Promise<HealthReport> {
    const probe = await this.database.probe();
    return {
      status: overallStatus(probe),
      service: SERVICE_NAME,
      version: this.config.version,
      environment: this.config.env,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime() * 10) / 10,
      checks: {
        database: { status: probe.status, latencyMs: probe.latencyMs },
        postgis: { status: probe.postgis },
      },
    };
  }
}
