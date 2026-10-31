import { Module, type DynamicModule } from '@nestjs/common';
import { CommonModule } from './common/common.module.js';
import type { AppConfig } from './config/app-config.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { LoggingModule } from './logging/logging.module.js';

@Module({})
export class AppModule {
  /** The configuration is validated by the caller and injected, never read ad hoc from process.env. */
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule,
        DatabaseModule,
        CommonModule,
        HealthModule,
      ],
    };
  }
}
