export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSendResult {
  providerMessageId?: string;
}

/**
 * What the application needs from any mail system. Swapping providers means writing one class
 * that implements this; nothing else changes.
 */
export interface EmailProvider {
  readonly name: string;
  /** Resolves only when the provider has ACCEPTED the message; rejects otherwise. */
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('No email provider is configured.');
    this.name = 'EmailNotConfiguredError';
  }
}
