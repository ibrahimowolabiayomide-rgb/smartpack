import { Inject, Injectable, Logger } from '@nestjs/common';
import type { EmailDeliveryStatus } from '@smartpack/shared';
import { DatabaseService } from '../database/database.service.js';
import { summariseDatabaseError } from '../database/error-summary.js';
import { emailDeliveries } from '../database/schema/index.js';
import { EMAIL_PROVIDER, EmailNotConfiguredError, type EmailProvider } from './email.types.js';
import { renderEmail, type EmailTemplate } from './templates.js';

const MAX_ERROR_LENGTH = 300;

/** Keeps a provider failure short and free of anything that looks like a credential. */
export function describeFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'unknown error';
  const firstLine = raw.split('\n')[0] ?? 'unknown error';
  return firstLine
    .replace(/(pass(word)?|pwd|auth|api-?key)[=:]\s*\S+/gi, '$1=[redacted]')
    .replace(/xkeysib-[\w-]+/gi, '[redacted]')
    .slice(0, MAX_ERROR_LENGTH);
}

export interface SendEmailInput {
  template: EmailTemplate;
  to: string;
  organizationId?: string | null;
  requestId: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly database: DatabaseService,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  /**
   * Hands one message to the provider and reports the truth:
   * `sent` only if the provider accepted it, `failed` if it refused or errored, and
   * `not_configured` if no provider is set up. Never throws and never holds a database
   * transaction: callers invoke it after their transaction has committed.
   */
  async send(input: SendEmailInput): Promise<EmailDeliveryStatus> {
    const rendered = renderEmail(input.template);
    try {
      const result = await this.provider.send({ to: input.to, ...rendered });
      await this.log(input, 'sent', result.providerMessageId ?? null, null);
      return 'sent';
    } catch (error) {
      if (error instanceof EmailNotConfiguredError) {
        this.logger.warn(
          `Email "${input.template.name}" not sent: no provider configured (requestId ${input.requestId})`,
        );
        return 'not_configured';
      }
      const reason = describeFailure(error);
      this.logger.error(
        `Email "${input.template.name}" failed via ${this.provider.name}: ${reason} (requestId ${input.requestId})`,
      );
      await this.log(input, 'failed', null, reason);
      return 'failed';
    }
  }

  /** Fire-and-forget variant for public endpoints whose response must not depend on delivery. */
  sendInBackground(input: SendEmailInput): void {
    void this.send(input);
  }

  private async log(
    input: SendEmailInput,
    status: 'sent' | 'failed',
    providerMessageId: string | null,
    error: string | null,
  ): Promise<void> {
    try {
      await this.database.db.insert(emailDeliveries).values({
        organizationId: input.organizationId ?? null,
        template: input.template.name,
        toEmail: input.to,
        status,
        provider: this.provider.name,
        providerMessageId,
        error,
        requestId: input.requestId,
      });
    } catch (logError) {
      this.logger.error(`Could not record email delivery: ${summariseDatabaseError(logError)}`);
    }
  }
}
