import { Inject, Injectable } from '@nestjs/common';
import { hash, verify, type Algorithm } from '@node-rs/argon2';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/config.constants.js';

/** `Algorithm.Argon2id`. The package exports a const enum, which isolatedModules cannot import. */
const ARGON2ID = 2 as Algorithm;

/**
 * Argon2id password hashing. Parameters come from configuration (OWASP minimum in production:
 * 19 MiB memory, 2 passes, 1 lane). The PHC string stores salt and parameters, so changing the
 * configuration never invalidates existing hashes: they are re-hashed at the next successful sign-in.
 *
 * Hashing runs on the libuv thread pool, so it does not block the event loop.
 */
@Injectable()
export class PasswordHasher {
  private readonly options: {
    algorithm: Algorithm;
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  };
  private dummyHash: Promise<string> | undefined;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const { memoryKib, timeCost, parallelism } = config.auth.argon2;
    this.options = {
      algorithm: ARGON2ID,
      memoryCost: memoryKib,
      timeCost,
      parallelism,
    };
  }

  hash(password: string): Promise<string> {
    return hash(password, this.options);
  }

  /** Returns false for a wrong password and for a malformed stored hash; never throws. */
  async verify(storedHash: string, password: string): Promise<boolean> {
    try {
      return await verify(storedHash, password);
    } catch {
      return false;
    }
  }

  /** True when the stored hash was made with weaker parameters than are configured now. */
  needsRehash(storedHash: string): boolean {
    const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(storedHash);
    if (!match) return true;
    const [, memory, time, parallelism] = match;
    return (
      Number(memory) < this.options.memoryCost ||
      Number(time) < this.options.timeCost ||
      Number(parallelism) !== this.options.parallelism
    );
  }

  /**
   * Spends the same time as a real verification. Used when the account does not exist so that
   * response time does not reveal which email addresses have accounts.
   */
  async verifyAgainstDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash('smartpack-timing-equaliser');
    await this.verify(await this.dummyHash, password);
  }
}
