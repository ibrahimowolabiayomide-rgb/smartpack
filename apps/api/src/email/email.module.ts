import { Global, Module } from '@nestjs/common';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/config.constants.js';
import { DevMailboxController } from './dev-mailbox.controller.js';
import { EmailService } from './email.service.js';
import { EMAIL_PROVIDER, type EmailProvider } from './email.types.js';
import { DevCaptureEmailProvider, NoEmailProvider, SmtpEmailProvider } from './providers.js';

function createProvider(config: AppConfig): EmailProvider {
  switch (config.email.provider) {
    case 'dev-capture':
      return new DevCaptureEmailProvider(config.email.from);
    case 'smtp':
      if (config.email.smtp === null) throw new Error('SMTP selected without SMTP settings.');
      return new SmtpEmailProvider(config.email.from, config.email.smtp);
    case 'none':
      return new NoEmailProvider();
  }
}

@Global()
@Module({
  controllers: [DevMailboxController],
  providers: [
    { provide: EMAIL_PROVIDER, inject: [APP_CONFIG], useFactory: createProvider },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
