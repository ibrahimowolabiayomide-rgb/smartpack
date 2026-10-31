import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Type } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { configureApp, createFastifyAdapter } from '../src/app.setup.js';
import { loadConfig, type AppConfig } from '../src/config/app-config.js';
import { runMigrations } from '../src/database/run-migrations.js';

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Integration tests need a dedicated PostgreSQL database; ' +
        'see docs/DEVELOPMENT_SETUP.md.',
    );
  }
  return url;
}

/** Builds validated test configuration; overrides win over the defaults below. */
export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    DATABASE_SSL: 'disable',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    ...overrides,
  });
}

/** Applies migrations to the test database (idempotent). */
export async function migrateTestDatabase(): Promise<void> {
  await runMigrations(testConfig().database);
}

/**
 * Creates the real application, configured exactly as in production code paths
 * (same configureApp), optionally with extra controllers for exercising shared conventions.
 */
export async function createTestApp(
  config: AppConfig,
  extraControllers: Type<unknown>[] = [],
): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config)],
    controllers: extraControllers,
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter());
  await configureApp(app, config);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

/** Points the database at a port nothing listens on, to simulate an outage. */
export function unreachableDatabaseUrl(): string {
  const url = new URL(testDatabaseUrl());
  url.hostname = '127.0.0.1';
  url.port = '1';
  return url.toString();
}
