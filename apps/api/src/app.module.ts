import { Module, type DynamicModule } from '@nestjs/common';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CommonModule } from './common/common.module.js';
import type { AppConfig } from './config/app-config.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EmailModule } from './email/email.module.js';
import { HealthModule } from './health/health.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { LoggingModule } from './logging/logging.module.js';
import { MembersModule } from './members/members.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { RolesModule } from './roles/roles.module.js';
import { SecurityModule } from './security/security.module.js';

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
        SecurityModule,
        AuditModule,
        EmailModule,
        AuthModule,
        RolesModule,
        OrganizationsModule,
        MembersModule,
        InvitationsModule,
        HealthModule,
      ],
    };
  }
}
