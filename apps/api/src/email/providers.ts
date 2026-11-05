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

const BREVO_TIMEOUT_MS = 10_000;
const BREVO_MAX_DETAIL_LENGTH = 200;

/** A failure reported by, or on the way to, Brevo. The message never contains the API key. */
export class BrevoDeliveryError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'BrevoDeliveryError';
  }
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Delivers through Brevo's transactional HTTP API (`POST /v3/smtp/email`). Resolves only when Brevo
 * answers 2xx, which means Brevo accepted the message for delivery; any other outcome rejects with
 * a short, credential-free reason. There are no retries: a retry after a timeout could send the
 * same message twice, and the caller already reports `failed` truthfully.
 */
export class BrevoEmailProvider implements EmailProvider {
  readonly name = 'brevo';

  constructor(
    private readonly settings: {
      apiKey: string;
      baseUrl: string;
      sender: { name: string; email: string };
    },
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.settings.baseUrl}/v3/smtp/email`, {
        method: 'POST',
        headers: {
          'api-key': this.settings.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.settings.sender.name, email: this.settings.sender.email },
          to: [{ email: message.to }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        }),
        // The API key must never follow a redirect to another host.
        redirect: 'error',
        signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new BrevoDeliveryError(
        timedOut ? 'Brevo did not answer in time.' : 'Brevo could not be reached.',
        null,
      );
    }

    const body = await this.readBody(response);
    if (!response.ok) {
      throw new BrevoDeliveryError(this.describeRejection(response.status, body), response.status);
    }
    const messageId = typeof body?.messageId === 'string' ? body.messageId : undefined;
    return { providerMessageId: messageId };
  }

  private async readBody(response: Response): Promise<Record<string, unknown> | null> {
    try {
      const parsed: unknown = JSON.parse(await response.text());
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private describeRejection(status: number, body: Record<string, unknown> | null): string {
    const hint =
      status === 401
        ? ' The API key was rejected; check BREVO_API_KEY.'
        : status === 403
          ? ' The key may lack permission, or the request came from an IP address that is not authorised in Brevo.'
          : status === 429
            ? ' Brevo is rate limiting this account.'
            : '';
    const detail =
      typeof body?.message === 'string'
        ? ` ${this.scrub(body.message).replace(/\s+/g, ' ').slice(0, BREVO_MAX_DETAIL_LENGTH)}`
        : '';
    return `Brevo refused the message (HTTP ${status}).${hint}${detail}`;
  }

  /** Brevo should never echo the key, but nothing derived from a response is trusted. */
  private scrub(text: string): string {
    return text.split(this.settings.apiKey).join('[redacted]');
  }
}
