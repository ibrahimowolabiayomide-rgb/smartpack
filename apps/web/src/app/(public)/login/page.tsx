import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Notice } from '@/components/ui/notice';
import { LoginForm } from '@/features/auth/login-form';
import { safeNextPath } from '@/lib/auth/next-path';
import { getSession } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'Sign in' };

type SearchParams = Promise<{ next?: string; reason?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, reason } = await searchParams;
  const session = await getSession();
  if (session.status === 'authenticated') redirect(safeNextPath(next) as never);

  return (
    <div className="flex flex-1 items-start justify-center py-10 lg:py-20">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-title font-semibold tracking-tight">Sign in</h1>
          <p className="text-ui text-ink-muted">Company sign-in for administrators and workers.</p>
        </div>
        {session.status === 'unavailable' ? (
          <Notice tone="warning" title="The SmartPack service is not reachable">
            Sign-in needs the service. Check your connection and try again in a moment.
          </Notice>
        ) : null}
        <LoginForm
          next={next}
          notice={
            reason === 'expired' ? 'expired' : reason === 'signed-out' ? 'signed-out' : undefined
          }
        />
        <p className="text-meta text-ink-muted">
          There is no public sign-up. New people join by invitation from a company administrator.
        </p>
      </div>
    </div>
  );
}
