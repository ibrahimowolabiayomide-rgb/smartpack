import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  changePasswordRequestSchema,
  currentUserSchema,
  emailDeliveryStatusSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  messageSchema,
  resetPasswordRequestSchema,
  sessionSummarySchema,
  uuidSchema,
  verifyEmailRequestSchema,
  type ChangePasswordInput,
  type LoginRequest,
} from '@smartpack/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApiEndpoint } from '../common/http/api-docs.js';
import { Ctx, type RequestContext } from '../common/http/request-context.js';
import { RATE_LIMITS } from '../security/rate-limiter.js';
import { toCurrentUser, type AuthContext } from './auth-context.js';
import { AuthService } from './auth.service.js';
import { Auth, Public, RateLimit } from './decorators.js';
import { SessionsService } from './sessions.service.js';

const sessionParams = z.object({ sessionId: uuidSchema });

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Public()
  @RateLimit(RATE_LIMITS.loginPerIp)
  @Post('login')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Sign in',
    description:
      'Verifies the password and starts a session, delivered as an HttpOnly cookie. Every failure ' +
      '(unknown address, wrong password, suspended account or membership) returns the same ' +
      '`INVALID_CREDENTIALS` response so accounts cannot be enumerated.',
    access: 'public',
    request: loginRequestSchema,
    response: currentUserSchema,
    errors: [400, 413, 415],
  })
  async login(
    @Body({ schema: loginRequestSchema }) body: LoginRequest,
    @Ctx() context: RequestContext,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const signedIn = await this.auth.login(body, context, this.sessions.tokenFrom(request.cookies));
    this.sessions.setCookie(reply, signedIn.token, signedIn.expiresAt);
    void reply.header('cache-control', 'no-store');
    return signedIn.current;
  }

  @Post('logout')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Sign out',
    description: 'Revokes the current session on the server and clears the cookie.',
    access: 'authenticated',
    response: messageSchema,
  })
  async logout(
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.logout(auth, context);
    this.sessions.clearCookie(reply);
    return { message: 'Signed out.' };
  }

  @Post('logout-all')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Sign out everywhere',
    description: 'Revokes every session of the current user, including this one.',
    access: 'authenticated',
    response: messageSchema,
  })
  async logoutAll(
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.logoutAll(auth, context);
    this.sessions.clearCookie(reply);
    return { message: 'Signed out of all devices.' };
  }

  @Get('me')
  @ApiEndpoint({
    summary: 'Current user',
    description:
      "The caller's identity, company, role and effective permissions, rebuilt from the database on every call.",
    access: 'authenticated',
    response: currentUserSchema,
  })
  me(@Auth() auth: AuthContext, @Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header('cache-control', 'no-store');
    return toCurrentUser(auth);
  }

  @Public()
  @RateLimit(RATE_LIMITS.passwordForgotPerIp)
  @Post('password/forgot')
  @HttpCode(202)
  @ApiEndpoint({
    summary: 'Request a password reset email',
    description:
      'Always answers 202 with the same body, whether or not an account exists. If it does, a ' +
      'single-use link is emailed (when an email provider is configured).',
    access: 'public',
    request: forgotPasswordRequestSchema,
    response: messageSchema,
    status: 202,
    errors: [400, 413, 415],
  })
  async forgotPassword(
    @Body({ schema: forgotPasswordRequestSchema })
    body: z.infer<typeof forgotPasswordRequestSchema>,
    @Ctx() context: RequestContext,
  ) {
    await this.auth.requestPasswordReset(body.email, context);
    return { message: 'If an account exists for that address, a reset link has been sent.' };
  }

  @Public()
  @RateLimit(RATE_LIMITS.passwordResetPerIp)
  @Post('password/reset')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Set a new password with a reset link',
    description: 'The link is single-use and expires. All existing sessions are revoked.',
    access: 'public',
    request: resetPasswordRequestSchema,
    response: messageSchema,
    errors: [400, 413, 415],
  })
  async resetPassword(
    @Body({ schema: resetPasswordRequestSchema }) body: z.infer<typeof resetPasswordRequestSchema>,
    @Ctx() context: RequestContext,
  ) {
    await this.auth.resetPassword(body.token, body.newPassword, context);
    return { message: 'Password updated. Sign in with the new password.' };
  }

  @Post('password/change')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Change own password',
    description:
      'Requires the current password. Revokes every session, then starts a new one for this device.',
    access: 'authenticated',
    request: changePasswordRequestSchema,
    response: currentUserSchema,
    errors: [400, 413, 415],
  })
  async changePassword(
    @Body({ schema: changePasswordRequestSchema }) body: ChangePasswordInput,
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const signedIn = await this.auth.changePassword(auth, body, context);
    this.sessions.setCookie(reply, signedIn.token, signedIn.expiresAt);
    void reply.header('cache-control', 'no-store');
    return signedIn.current;
  }

  @Public()
  @Post('email/verify')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Verify an email address',
    description: 'Consumes a single-use verification link.',
    access: 'public',
    request: verifyEmailRequestSchema,
    response: messageSchema,
    errors: [400, 413, 415],
  })
  async verifyEmail(
    @Body({ schema: verifyEmailRequestSchema }) body: z.infer<typeof verifyEmailRequestSchema>,
    @Ctx() context: RequestContext,
  ) {
    await this.auth.verifyEmail(body.token, context);
    return { message: 'Email address verified.' };
  }

  @Post('email/resend-verification')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Send a new verification email',
    description:
      'Reports whether the email provider accepted the message (`sent`), refused it (`failed`) or ' +
      'is not configured (`not_configured`).',
    access: 'authenticated',
    response: z.object({ emailDelivery: emailDeliveryStatusSchema }),
    errors: [409],
  })
  async resendVerification(@Auth() auth: AuthContext, @Ctx() context: RequestContext) {
    return { emailDelivery: await this.auth.resendVerification(auth, context) };
  }

  @Get('sessions')
  @ApiEndpoint({
    summary: 'List own active sessions',
    access: 'authenticated',
    response: z.object({ items: z.array(sessionSummarySchema) }),
  })
  async listSessions(@Auth() auth: AuthContext) {
    return { items: await this.auth.listSessions(auth) };
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Revoke every other session',
    access: 'authenticated',
    response: z.object({ revoked: z.number().int() }),
  })
  async revokeOthers(@Auth() auth: AuthContext, @Ctx() context: RequestContext) {
    return { revoked: await this.auth.revokeOtherSessions(auth, context) };
  }

  @Delete('sessions/:sessionId')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Revoke one of own sessions',
    description: "Another user's session id is reported as not found.",
    access: 'authenticated',
    response: messageSchema,
    errors: [400, 404],
  })
  async revokeSession(
    @Param({ schema: sessionParams }) params: z.infer<typeof sessionParams>,
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.revokeSession(auth, params.sessionId, context);
    if (params.sessionId === auth.sessionId) this.sessions.clearCookie(reply);
    return { message: 'Session revoked.' };
  }
}
