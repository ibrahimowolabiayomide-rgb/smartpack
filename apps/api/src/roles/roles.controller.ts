import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { holdsAllPermissions, permissionSchema, roleSchema } from '@smartpack/shared';
import { z } from 'zod';
import { Auth, RequirePermissions } from '../auth/decorators.js';
import type { AuthContext } from '../auth/auth-context.js';
import { ApiEndpoint } from '../common/http/api-docs.js';
import { RolesService } from './roles.service.js';

@ApiTags('Roles and permissions')
@Controller('organizations/current')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('roles')
  @RequirePermissions('users.view')
  @ApiEndpoint({
    summary: 'List roles',
    description:
      'Built-in roles with their permissions. `assignable` is false when the caller lacks a ' +
      'permission the role carries, because nobody may grant more than they hold.',
    access: { permission: 'users.view' },
    response: z.object({ items: z.array(roleSchema) }),
  })
  async listRoles(@Auth() auth: AuthContext) {
    const all = await this.roles.all();
    return {
      items: all.map((role) => ({
        key: role.key,
        name: role.name,
        description: role.description,
        rank: role.rank,
        permissions: role.permissions,
        assignable: holdsAllPermissions([...auth.permissions], role.permissions),
      })),
    };
  }

  @Get('permissions')
  @RequirePermissions('users.view')
  @ApiEndpoint({
    summary: 'List permissions',
    access: { permission: 'users.view' },
    response: z.object({ items: z.array(permissionSchema) }),
  })
  async listPermissions() {
    return { items: await this.roles.permissionCatalogue() };
  }
}
