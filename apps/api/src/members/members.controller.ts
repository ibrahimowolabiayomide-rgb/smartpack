import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  changeRoleRequestSchema,
  listMembersQuerySchema,
  memberSchema,
  pageSchema,
  updateMemberRequestSchema,
  uuidSchema,
} from '@smartpack/shared';
import { z } from 'zod';
import { Auth, RequirePermissions } from '../auth/decorators.js';
import type { AuthContext } from '../auth/auth-context.js';
import { ApiEndpoint } from '../common/http/api-docs.js';
import { Ctx, type RequestContext } from '../common/http/request-context.js';
import { MembersService } from './members.service.js';

const memberParams = z.object({ memberId: uuidSchema });

@ApiTags('Members')
@Controller('organizations/current/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequirePermissions('users.view')
  @ApiEndpoint({
    summary: 'List company members',
    description:
      'Paginated (`page`, `pageSize` up to 100), ordered by name then id. Removed members are ' +
      'hidden unless `status=removed` is requested.',
    access: { permission: 'users.view' },
    response: pageSchema(memberSchema),
    errors: [400],
  })
  list(
    @Query({ schema: listMembersQuerySchema }) query: z.infer<typeof listMembersQuerySchema>,
    @Auth() auth: AuthContext,
  ) {
    return this.members.list(auth, query);
  }

  @Get(':memberId')
  @RequirePermissions('users.view')
  @ApiEndpoint({
    summary: 'Get a member',
    description: 'A member of another company is reported as not found.',
    access: { permission: 'users.view' },
    response: memberSchema,
    errors: [400, 404],
  })
  get(
    @Param({ schema: memberParams }) params: z.infer<typeof memberParams>,
    @Auth() auth: AuthContext,
  ) {
    return this.members.get(auth, params.memberId);
  }

  @Patch(':memberId')
  @RequirePermissions('users.update')
  @ApiEndpoint({
    summary: "Edit a member's name",
    description:
      'Only while the account belongs to this company alone. You cannot edit a member whose role ' +
      'has more access than yours.',
    access: { permission: 'users.update' },
    request: updateMemberRequestSchema,
    response: memberSchema,
    errors: [400, 404, 409, 413, 415],
  })
  update(
    @Param({ schema: memberParams }) params: z.infer<typeof memberParams>,
    @Body({ schema: updateMemberRequestSchema }) body: z.infer<typeof updateMemberRequestSchema>,
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
  ) {
    return this.members.updateProfile(auth, params.memberId, body, context);
  }

  @Patch(':memberId/role')
  @RequirePermissions('roles.manage')
  @ApiEndpoint({
    summary: "Change a member's role",
    description:
      'You cannot change your own role, act on a member whose role has more access than yours, ' +
      'assign a role with more access than yours, or demote the last active owner.',
    access: { permission: 'roles.manage' },
    request: changeRoleRequestSchema,
    response: memberSchema,
    errors: [400, 404, 409, 413, 415],
  })
  changeRole(
    @Param({ schema: memberParams }) params: z.infer<typeof memberParams>,
    @Body({ schema: changeRoleRequestSchema }) body: z.infer<typeof changeRoleRequestSchema>,
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
  ) {
    return this.members.changeRole(auth, params.memberId, body.role, context);
  }

  @Post(':memberId/suspend')
  @HttpCode(200)
  @RequirePermissions('users.suspend')
  @ApiEndpoint({
    summary: 'Suspend a member',
    description:
      "Ends all of the member's sessions immediately. The last active owner cannot be suspended.",
    access: { permission: 'users.suspend' },
    response: memberSchema,
    errors: [400, 404, 409],
  })
  suspend(
    @Param({ schema: memberParams }) params: z.infer<typeof memberParams>,
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
  ) {
    return this.members.suspend(auth, params.memberId, context);
  }

  @Post(':memberId/reactivate')
  @HttpCode(200)
  @RequirePermissions('users.suspend')
  @ApiEndpoint({
    summary: 'Reactivate a suspended member',
    access: { permission: 'users.suspend' },
    response: memberSchema,
    errors: [400, 404, 409],
  })
  reactivate(
    @Param({ schema: memberParams }) params: z.infer<typeof memberParams>,
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
  ) {
    return this.members.reactivate(auth, params.memberId, context);
  }

  @Delete(':memberId')
  @HttpCode(200)
  @RequirePermissions('users.suspend')
  @ApiEndpoint({
    summary: "Remove a member's access",
    description:
      'Ends access and all sessions. The record is kept (status `removed`) so history stays ' +
      'attributable; the person can be invited again later.',
    access: { permission: 'users.suspend' },
    response: memberSchema,
    errors: [400, 404, 409],
  })
  remove(
    @Param({ schema: memberParams }) params: z.infer<typeof memberParams>,
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
  ) {
    return this.members.remove(auth, params.memberId, context);
  }
}
