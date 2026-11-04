import { randomUUID } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailConfig } from '../config/app-config.js';
import {
  EmailNotConfiguredError,
  type EmailMessage,
  type EmailProvider,
  type EmailSendResult,
} from './email.types.js';

/** Production default: nothing is sent and the caller is told so, never "sent". */
export class NoEmailProvider implements EmailProvider {
  readonly name = 'none';
  send(): Promise<EmailSendResult> {
    return Promise.reject(new EmailNotConfiguredError());
  }
}

export interface CapturedEmail extends EmailMessage {
  id: string;
  from: string;
  capturedAt: string;
}

const MAX_CAPTURED = 200;

/**
 * Development and test only: keeps messages in memory instead of sending them, so invitation,
 * reset and verification flows can be exercised end to end without any mail service. The config
 * layer refuses this provider in production. It is NOT real delivery and is reported as such.
 */
export class DevCaptureEmailProvider implements EmailProvider {
  readonly name = 'dev-capture';
  private readonly messages: CapturedEmail[] = [];

  constructor(private readonly from: string) {}

  send(message: EmailMessage): Promise<EmailSendResult> {
    const id = randomUUID();
    this.messages.push({ ...message, id, from: this.from, capturedAt: new Date().toISOString() });
    if (this.messages.length > MAX_CAPTURED) this.messages.shift();
    return Promise.resolve({ providerMessageId: id });
  }

  list(): CapturedEmail[] {
    return [...this.messages].reverse();
  }

  clear(): void {
    this.messages.length = 0;
  }
}

const SMTP_TIMEOUT_MS = 10_000;

/** Delivers through any SMTP server the company chooses. Credentials come from the environment. */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly transporter: Transporter;

  constructor(
    private readonly from: string,
    smtp: NonNullable<EmailConfig['smtp']>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth:
        smtp.user !== undefined && smtp.password !== undefined
          ? { user: smtp.user, pass: smtp.password }
          : undefined,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
      // STARTTLS is required whenever the server offers it and the connection is not already TLS.
      requireTLS: !smtp.secure && smtp.host !== 'localhost' && smtp.host !== '127.0.0.1',
    });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const info = (await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })) as { messageId?: string; accepted?: unknown[] };
    if (!Array.isArray(info.accepted) || info.accepted.length === 0) {
      throw new Error('The SMTP server did not accept the recipient.');
    }
    return { providerMessageId: info.messageId };
  }
}
