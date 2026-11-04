import { Global, Module } from '@nestjs/common';
import { PasswordHasher } from './password-hasher.js';
import { RateLimiter } from './rate-limiter.js';

@Global()
@Module({
  providers: [PasswordHasher, RateLimiter],
  exports: [PasswordHasher, RateLimiter],
})
export class SecurityModule {}
