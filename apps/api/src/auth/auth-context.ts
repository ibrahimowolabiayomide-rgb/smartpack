import '@fastify/cookie';
import type { CurrentUser, PermissionKey, RoleKey } from '@smartpack/shared';

/**
 * The server-side identity of the caller, rebuilt from the database on every request. The company
 * context comes from the session's membership; nothing in it is taken from request input.
 */
export interface AuthContext {
  sessionId: string;
  sessionCreatedAt: Date;
  sessionExpiresAt: Date;
  user: {
    id: string;
    email: string;
    displayName: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    status: 'active' | 'disabled';
  };
  organization: { id: string; name: string; slug: string; timeZone: string };
  membership: { id: string; roleKey: RoleKey; roleName: string };
  permissions: ReadonlySet<string>;
}

export function has(auth: AuthContext, permission: PermissionKey): boolean {
  return auth.permissions.has(permission);
}

export function toCurrentUser(auth: AuthContext): CurrentUser {
  return {
    user: { ...auth.user },
    organization: { ...auth.organization },
    membership: {
      id: auth.membership.id,
      status: 'active',
      role: { key: auth.membership.roleKey, name: auth.membership.roleName },
    },
    permissions: [...auth.permissions].sort(),
    session: {
      id: auth.sessionId,
      createdAt: auth.sessionCreatedAt.toISOString(),
      expiresAt: auth.sessionExpiresAt.toISOString(),
    },
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
