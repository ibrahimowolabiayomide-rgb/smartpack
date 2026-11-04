import type { PermissionKey } from '@smartpack/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import type { ApiFailure } from '@/lib/api/client';
import { getSession } from '@/lib/auth/server';

/** Shown instead of a page the signed-in person has no permission to open. */
export function NoAccess({ what }: { what: string }) {
  return (
    <EmptyState
      title="You do not have access to this page"
      description={`${what} is available to people with the right role. Ask a company administrator if you need it.`}
    />
  );
}

/** Honest state for a read that failed, by cause. */
export function LoadFailure({ failure, what }: { failure: ApiFailure; what: string }) {
  const detail =
    failure.kind === 'http-error' && failure.error
      ? failure.error.message
      : failure.kind === 'unreachable'
        ? 'The service did not answer.'
        : undefined;
  return (
    <ErrorState
      title={`${what} could not be loaded`}
      description="Nothing has been changed. Reload the page to try again."
      detail={detail}
    />
  );
}

/** True when the signed-in person holds the permission. Pages still rely on the API to enforce it. */
export async function holds(permission: PermissionKey): Promise<boolean> {
  const session = await getSession();
  return session.status === 'authenticated' && session.user.permissions.includes(permission);
}
