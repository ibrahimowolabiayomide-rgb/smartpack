import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { ButtonLink } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { getSession } from '@/lib/auth/server';

/**
 * Every page in this route group is signed-in only. The API decides who is signed in, on every
 * request: a missing, expired, revoked or suspended session sends the person to sign-in. If the
 * API cannot be reached the page says so, rather than pretending the person is signed out or
 * showing private pages without checking.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session.status === 'anonymous') redirect('/login?reason=expired');
  if (session.status === 'unavailable') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-4 px-4 py-10">
        <ErrorState
          title="The SmartPack service is not reachable"
          description="Your session could not be checked, so no company pages are shown. This is usually temporary."
          action={
            <ButtonLink href="/dashboard" variant="secondary">
              Try again
            </ButtonLink>
          }
        />
      </main>
    );
  }
  return <AppShell user={session.user}>{children}</AppShell>;
}
