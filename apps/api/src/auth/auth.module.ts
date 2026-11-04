import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module.js';
import { SecurityModule } from '../security/security.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { OriginGuard } from './guards/origin.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { RateLimitGuard } from './guards/rate-limit.guard.js';
import { SessionsService } from './sessions.service.js';

/**
 * Guards run in registration order: origin check (CSRF), per-address rate limit, authentication,
 * then permissions. Together they make every route private unless explicitly marked @Public().
 */
@Global()
@Module({
  imports: [SecurityModule, AuditModule],
  controllers: [AuthController],
  providers: [
    SessionsService,
    AuthService,
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [SessionsService],
})
export class AuthModule {}
