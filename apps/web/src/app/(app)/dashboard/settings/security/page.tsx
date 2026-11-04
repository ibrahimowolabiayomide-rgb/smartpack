import { sessionSummarySchema } from '@smartpack/shared';
import type { Metadata } from 'next';
import { z } from 'zod';
import { Panel } from '@/components/ui/panel';
import { LoadFailure } from '@/features/settings/access';
import {
  ChangePasswordForm,
  EmailVerification,
  SessionsList,
} from '@/features/settings/security-panels';
import { authedGet, getSession } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'Account and security' };

export default async function SecurityPage() {
  const [session, sessions] = await Promise.all([
    getSession(),
    authedGet('/auth/sessions', z.object({ items: z.array(sessionSummarySchema) })),
  ]);
  if (session.status !== 'authenticated') return null;
  const { user, organization, membership } = session.user;

  return (
    <>
      <Panel title="Your account" headingId="account-heading">
        <dl className="flex flex-col">
          {[
            ['Name', user.displayName],
            ['Email address', user.email],
            ['Company', organization.name],
            ['Role', membership.role.name],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2.5 first:border-t"
            >
              <dt className="text-ink-muted">{label}</dt>
              <dd className="break-all text-ink">{value}</dd>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-2.5">
            <dt className="text-ink-muted">Email verification</dt>
            <dd>
              <EmailVerification />
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Change password" headingId="password-heading">
        <ChangePasswordForm />
      </Panel>

      <Panel title="Sessions" headingId="sessions-heading">
        {sessions.kind === 'ok' ? (
          <SessionsList sessions={sessions.data.items} timeZone={organization.timeZone} />
        ) : (
          <LoadFailure failure={sessions} what="Your sessions" />
        )}
      </Panel>
    </>
  );
}
