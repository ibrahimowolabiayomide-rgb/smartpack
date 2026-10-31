import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { AppConfig } from './app-config.js';
import { APP_CONFIG } from './config.constants.js';

/**
 * Makes the validated configuration injectable everywhere via `@Inject(APP_CONFIG)`.
 *
 * Configuration is loaded and validated once, before the Nest container is created
 * (see main.ts), then passed in. That keeps startup failures readable and lets tests
 * supply an explicit configuration instead of mutating `process.env`.
 */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
