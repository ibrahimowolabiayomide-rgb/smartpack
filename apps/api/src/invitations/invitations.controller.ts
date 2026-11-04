import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  acceptInvitationRequestSchema,
  createInvitationRequestSchema,
  invitationAcceptedSchema,
  invitationPreviewSchema,
  invitationSchema,
  invitationWithDeliverySchema,
  listInvitationsQuerySchema,
  pageSchema,
  previewInvitationRequestSchema,
  uuidSchema,
  type AcceptInvitationRequest,
} from '@smartpack/shared';
import { z } from 'zod';
import { Auth, Public, RequirePermissions } from '../auth/decorators.js';
import type { AuthContext } from '../auth/auth-context.js';
import { ApiEndpoint } from '../common/http/api-docs.js';
import { Ctx, type RequestContext } from '../common/http/request-context.js';
import { InvitationsService } from './invitations.service.js';

const invitationParams = z.object({ invitationId: uuidSchema });

@ApiTags('Invitations')
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get('organizations/current/invitations')
  @RequirePermissions('users.view')
  @ApiEndpoint({
    summary: 'List invitations',
    description: '`expired` is derived: a pending invitation whose deadline has passed.',
    access: { permission: 'users.view' },
    response: pageSchema(invitationSchema),
    errors: [400],
  })
  list(
    @Query({ schema: listInvitationsQuerySchema })
    query: z.infer<typeof listInvitationsQuerySchema>,
    @Auth() auth: AuthContext,
  ) {
    return this.invitations.list(auth, query);
  }

  @Post('organizations/current/invitations')
  @RequirePermissions('users.invite')
  @ApiEndpoint({
    summary: 'Invite someone to the company',
    description:
      'You can invite only to a role whose permissions you hold in full. `emailDelivery` reports ' +
      'whether the provider accepted the message; `not_configured` means no email provider is set ' +
      'up, in which case the invitation exists but nothing was sent.',
    access: { permission: 'users.invite' },
    request: createInvitationRequestSchema,
    response: invitationWithDeliverySchema,
    status: 201,
    errors: [400, 409, 413, 415],
  })
  create(
    @Body({ schema: createInvitationRequestSchema })
    body: z.infer<typeof createInvitationRequestSchema>,
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
  ) {
    return this.invitations.create(auth, body, context);
  }

  @Post('organizations/current/invitations/:invitationId/resend')
  @HttpCode(200)
  @RequirePermissions('users.invite')
  @ApiEndpoint({
    summary: 'Resend an invitation',
    description: 'Issues a new link and deadline; the previous link stops working.',
    access: { permission: 'users.invite' },
    response: invitationWithDeliverySchema,
    errors: [400, 404, 409],
  })
  resend(
    @Param({ schema: invitationParams }) params: z.infer<typeof invitationParams>,
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
  ) {
    return this.invitations.resend(auth, params.invitationId, context);
  }

  @Delete('organizations/current/invitations/:invitationId')
  @HttpCode(200)
  @RequirePermissions('users.invite')
  @ApiEndpoint({
    summary: 'Revoke a pending invitation',
    access: { permission: 'users.invite' },
    response: invitationSchema,
    errors: [400, 404, 409],
  })
  revoke(
    @Param({ schema: invitationParams }) params: z.infer<typeof invitationParams>,
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
  ) {
    return this.invitations.revoke(auth, params.invitationId, context);
  }

  @Public()
  @Post('invitations/preview')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Look up an invitation link',
    description:
      'Returns what the link is for so the page can show the right form. The token is sent in ' +
      'the body, never in the URL.',
    access: 'public',
    request: previewInvitationRequestSchema,
    response: invitationPreviewSchema,
    errors: [400, 413, 415],
  })
  preview(
    @Body({ schema: previewInvitationRequestSchema })
    body: z.infer<typeof previewInvitationRequestSchema>,
    @Ctx() context: RequestContext,
  ) {
    return this.invitations.preview(body.token, context);
  }

  @Public()
  @Post('invitations/accept')
  @HttpCode(201)
  @ApiEndpoint({
    summary: 'Accept an invitation',
    description:
      'New people set their name and password. Existing accounts must enter their current ' +
      'password. The link is single-use. Accepting does not sign anyone in.',
    access: 'public',
    request: acceptInvitationRequestSchema,
    response: invitationAcceptedSchema,
    status: 201,
    errors: [400, 409, 413, 415],
  })
  accept(
    @Body({ schema: acceptInvitationRequestSchema }) body: AcceptInvitationRequest,
    @Ctx() context: RequestContext,
  ) {
    return this.invitations.accept(body, context);
  }
}
