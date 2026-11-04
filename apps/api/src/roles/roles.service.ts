import { Injectable, NotFoundException } from '@nestjs/common';
import type { RoleKey } from '@smartpack/shared';
import { asc } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { permissions, rolePermissions, roles } from '../database/schema/index.js';

export interface RoleRecord {
  id: string;
  key: RoleKey;
  name: string;
  description: string;
  rank: number;
  permissions: string[];
}

const CACHE_TTL_MS = 60_000;

/** Roles and their grants are reference data changed only by migrations, so a short cache is safe. */
@Injectable()
export class RolesService {
  private cache: { at: number; roles: RoleRecord[] } | undefined;

  constructor(private readonly database: DatabaseService) {}

  async all(): Promise<RoleRecord[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.roles;
    const [roleRows, grantRows] = await Promise.all([
      this.database.db.select().from(roles).orderBy(asc(roles.rank)),
      this.database.db
        .select({ roleId: rolePermissions.roleId, key: rolePermissions.permissionKey })
        .from(rolePermissions),
    ]);
    const byRole = new Map<string, string[]>();
    for (const grant of grantRows) {
      byRole.set(grant.roleId, [...(byRole.get(grant.roleId) ?? []), grant.key]);
    }
    const loaded = roleRows.map((row) => ({
      id: row.id,
      key: row.key as RoleKey,
      name: row.name,
      description: row.description,
      rank: row.rank,
      permissions: (byRole.get(row.id) ?? []).sort(),
    }));
    this.cache = { at: Date.now(), roles: loaded };
    return loaded;
  }

  async byKey(key: string): Promise<RoleRecord> {
    const found = (await this.all()).find((role) => role.key === key);
    if (!found) throw new NotFoundException('Unknown role.');
    return found;
  }

  async byId(id: string): Promise<RoleRecord | undefined> {
    return (await this.all()).find((role) => role.id === id);
  }

  async permissionCatalogue() {
    return this.database.db
      .select()
      .from(permissions)
      .orderBy(asc(permissions.category), asc(permissions.key));
  }
}
