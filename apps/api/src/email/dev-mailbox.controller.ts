import { Controller, Delete, Get, HttpCode, Inject, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import { EMAIL_PROVIDER, type EmailProvider } from './email.types.js';
import { DevCaptureEmailProvider } from './providers.js';

/**
 * Lets automated tests and a developer read the messages the dev-capture provider holds.
 * It exists only when EMAIL_PROVIDER=dev-capture, which configuration forbids in production; with
 * any other provider every route here answers 404.
 */
@ApiExcludeController()
@Public()
@Controller('dev/mailbox')
export class DevMailboxController {
  constructor(@Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider) {}

  private capture(): DevCaptureEmailProvider {
    if (!(this.provider instanceof DevCaptureEmailProvider)) throw new NotFoundException();
    return this.provider;
  }

  @Get()
  list() {
    return { messages: this.capture().list() };
  }

  @Delete()
  @HttpCode(200)
  clear() {
    this.capture().clear();
    return { cleared: true };
  }
}
