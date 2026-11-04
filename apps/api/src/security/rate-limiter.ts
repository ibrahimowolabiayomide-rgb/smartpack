import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/config.constants.js';

export interface RateLimitPolicy {
  /** Stable name; also part of the bucket key. */
  name: string;
  limit: number;
  windowMs: number;
}

/**
 * The documented policies. Values are per key (an IP address, an email, a user) over a sliding
 * window, and are multiplied by RATE_LIMIT_SCALE. See docs/RATE_LIMITING.md.
 */
export const RATE_LIMITS = {
  /** Any sign-in attempt from one address. Generous: an office shares one public IP. */
  loginPerIp: { name: 'login-ip', limit: 40, windowMs: 15 * 60_000 },
  /** FAILED sign-ins for one account from one address. Successes do not count. */
  loginFailuresPerAccountAndIp: { name: 'login-fail-account-ip', limit: 5, windowMs: 15 * 60_000 },
  /** FAILED sign-ins for one account from anywhere; blocks distributed guessing without locking
   *  the real user out for long. */
  loginFailuresPerAccount: { name: 'login-fail-account', limit: 25, windowMs: 60 * 60_000 },
  passwordForgotPerIp: { name: 'password-forgot-ip', limit: 10, windowMs: 15 * 60_000 },
  passwordForgotPerEmail: { name: 'password-forgot-email', limit: 3, windowMs: 60 * 60_000 },
  passwordResetPerIp: { name: 'password-reset-ip', limit: 10, windowMs: 15 * 60_000 },
  passwordChangePerUser: { name: 'password-change-user', limit: 10, windowMs: 15 * 60_000 },
  emailVerifyPerIp: { name: 'email-verify-ip', limit: 20, windowMs: 15 * 60_000 },
  emailResendPerUser: { name: 'email-resend-user', limit: 3, windowMs: 60 * 60_000 },
  invitationTokenPerIp: { name: 'invitation-token-ip', limit: 20, windowMs: 15 * 60_000 },
  invitationAcceptFailuresPerEmailAndIp: {
    name: 'invitation-accept-fail',
    limit: 5,
    windowMs: 15 * 60_000,
  },
  invitationSendPerUser: { name: 'invitation-send-user', limit: 30, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest counted hit leaves the window; 0 when allowed. */
  retryAfterSeconds: number;
}

const MAX_KEYS = 100_000;
const SWEEP_INTERVAL_MS = 60_000;

/**
 * In-process sliding-window limiter. No Redis, no extra infrastructure.
 *
 * Limits are per API process: with several instances each keeps its own counters, so the
 * effective allowance is multiplied by the instance count. That is acceptable for the first
 * deployment and is recorded in docs/RATE_LIMITING.md; a shared store is a decision to take
 * (with its cost) when the API is scaled out. Memory is bounded: each key holds at most `limit`
 * timestamps, expired keys are swept every minute, and the key count is capped.
 */
@Injectable()
export class RateLimiter implements OnModuleDestroy {
  private readonly hits = new Map<string, number[]>();
  private readonly sweeper: NodeJS.Timeout;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  private effectiveLimit(policy: RateLimitPolicy): number {
    return Math.max(1, Math.round(policy.limit * this.config.rateLimit.scale));
  }

  private bucketKey(policy: RateLimitPolicy, key: string): string {
    return `${policy.name}:${key}`;
  }

  private live(policy: RateLimitPolicy, key: string, now: number): number[] {
    const bucketKey = this.bucketKey(policy, key);
    const cutoff = now - policy.windowMs;
    const kept = (this.hits.get(bucketKey) ?? []).filter((timestamp) => timestamp > cutoff);
    if (kept.length === 0) this.hits.delete(bucketKey);
    else this.hits.set(bucketKey, kept);
    return kept;
  }

  private result(policy: RateLimitPolicy, hits: number[], now: number): RateLimitResult {
    const limit = this.effectiveLimit(policy);
    if (hits.length < limit) return { allowed: true, retryAfterSeconds: 0 };
    const oldestCounted = hits[hits.length - limit] ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldestCounted + policy.windowMs - now) / 1000)),
    };
  }

  /** Reports whether another hit would be allowed, without counting one. */
  peek(policy: RateLimitPolicy, key: string, now = Date.now()): RateLimitResult {
    if (!this.config.rateLimit.enabled) return { allowed: true, retryAfterSeconds: 0 };
    return this.result(policy, this.live(policy, key, now), now);
  }

  /** Counts one hit. Returns the state BEFORE this hit: a denied hit is not recorded. */
  consume(policy: RateLimitPolicy, key: string, now = Date.now()): RateLimitResult {
    if (!this.config.rateLimit.enabled) return { allowed: true, retryAfterSeconds: 0 };
    const hits = this.live(policy, key, now);
    const outcome = this.result(policy, hits, now);
    if (outcome.allowed) this.record(policy, key, hits, now);
    return outcome;
  }

  /** Records a hit unconditionally (used for failures that are counted after the fact). */
  record(policy: RateLimitPolicy, key: string, existing?: number[], now = Date.now()): void {
    if (!this.config.rateLimit.enabled) return;
    const hits = existing ?? this.live(policy, key, now);
    hits.push(now);
    const limit = this.effectiveLimit(policy);
    if (hits.length > limit) hits.splice(0, hits.length - limit);
    if (this.hits.size >= MAX_KEYS && !this.hits.has(this.bucketKey(policy, key))) {
      this.sweep(now);
      if (this.hits.size >= MAX_KEYS) {
        const oldest = this.hits.keys().next();
        if (!oldest.done) this.hits.delete(oldest.value);
      }
    }
    this.hits.set(this.bucketKey(policy, key), hits);
  }

  reset(policy: RateLimitPolicy, key: string): void {
    this.hits.delete(this.bucketKey(policy, key));
  }

  private sweep(now = Date.now()): void {
    for (const [key, timestamps] of this.hits) {
      const newest = timestamps[timestamps.length - 1] ?? 0;
      // The longest window is one hour; anything older than that is dead in every policy.
      if (now - newest > 60 * 60_000) this.hits.delete(key);
    }
  }

  /** Test support. */
  size(): number {
    return this.hits.size;
  }
}
