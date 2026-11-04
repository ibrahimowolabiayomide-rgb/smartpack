import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  organizationSchema,
  updateOrganizationRequestSchema,
  type UpdateOrganizationRequest,
} from '@smartpack/shared';
import { Auth, RequirePermissions } from '../auth/decorators.js';
import type { AuthContext } from '../auth/auth-context.js';
import { ApiEndpoint } from '../common/http/api-docs.js';
import { Ctx, type RequestContext } from '../common/http/request-context.js';
import { OrganizationsService } from './organizations.service.js';

@ApiTags('Organization')
@Controller('organizations/current')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @RequirePermissions('organization.view')
  @ApiEndpoint({
    summary: 'Get the current company',
    description: 'The company of the signed-in user. There is no way to request another one.',
    access: { permission: 'organization.view' },
    response: organizationSchema,
  })
  get(@Auth() auth: AuthContext) {
    return this.organizations.getCurrent(auth);
  }

  @Patch()
  @RequirePermissions('organization.manage')
  @ApiEndpoint({
    summary: 'Update company settings',
    description: 'Name, time zone and country. The slug is immutable.',
    access: { permission: 'organization.manage' },
    request: updateOrganizationRequestSchema,
    response: organizationSchema,
    errors: [400, 413, 415],
  })
  update(
    @Body({ schema: updateOrganizationRequestSchema }) body: UpdateOrganizationRequest,
    @Auth() auth: AuthContext,
    @Ctx() context: RequestContext,
  ) {
    return this.organizations.updateCurrent(auth, body, context);
  }
}
