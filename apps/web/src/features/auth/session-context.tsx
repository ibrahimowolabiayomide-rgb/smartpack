'use client';

import type { CurrentUser, PermissionKey } from '@smartpack/shared';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface SessionValue {
  user: CurrentUser;
  /** True when the signed-in person holds the permission. The server enforces it regardless. */
  can: (permission: PermissionKey) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Makes the signed-in person available to client components. This only shapes what is shown
 * (hide a button the person cannot use); every action is checked again by the API.
 */
export function SessionProvider({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const value = useMemo<SessionValue>(() => {
    const held = new Set(user.permissions);
    return { user, can: (permission) => held.has(permission) };
  }, [user]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
