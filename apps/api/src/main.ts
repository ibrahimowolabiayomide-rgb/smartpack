import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp, createFastifyAdapter } from './app.setup.js';
import { ConfigError, loadConfig, type AppConfig } from './config/app-config.js';
import { API_DOCS_PATH, API_PREFIX } from './config/app-info.js';

async function bootstrap(): Promise<void> {
  // Validate configuration before anything else so a mistake fails fast with a readable
  // message instead of a stack trace from deep inside the framework.
  let config: AppConfig;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(config),
    createFastifyAdapter(),
    { bufferLogs: true },
  );
  const logger = app.get(Logger);
  app.useLogger(logger);

  await configureApp(app, config);
  await app.listen({ port: config.port, host: config.host });

  logger.log(
    `SmartPack API ${config.version} (${config.env}) listening on http://${config.host}:${config.port}/${API_PREFIX}`,
  );
  if (config.docs.enabled) {
    logger.log(`API documentation: http://${config.host}:${config.port}/${API_DOCS_PATH}`);
  }
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(
    `Failed to start the API: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exit(1);
});
