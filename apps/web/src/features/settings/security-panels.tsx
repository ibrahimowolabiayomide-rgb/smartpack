'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  currentUserSchema,
  emailDeliveryStatusSchema,
  messageSchema,
  type SessionSummary,
} from '@smartpack/shared';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { DataTable, Td, Th } from '@/components/ui/data-table';
import { Notice } from '@/components/ui/notice';
import { PasswordField } from '@/components/ui/password-field';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/components/ui/toast';
import { useSession } from '@/features/auth/session-context';
import { checkNewPassword, PASSWORD_HINT } from '@/features/auth/password-rules';
import { apiRequest, describeFailure, type FieldErrors } from '@/lib/api/browser';
import { formatTimestamp } from '@/lib/format';

export function EmailVerification() {
  const { user } = useSession();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  if (user.user.emailVerified) return <StatusBadge tone="positive">Verified</StatusBadge>;

  const resend = async () => {
    setPending(true);
    const result = await apiRequest('POST', '/auth/email/resend-verification', {
      body: {},
      schema: z.object({ emailDelivery: emailDeliveryStatusSchema }),
    });
    setPending(false);
    if (!result.ok) {
      toast.notify({
        tone: 'error',
        title: 'Could not send',
        description: describeFailure(result),
      });
    } else if (result.data.emailDelivery === 'sent') {
      toast.notify({
        tone: 'success',
        title: 'Verification email sent',
        description: `Check ${user.user.email}.`,
      });
    } else if (result.data.emailDelivery === 'not_configured') {
      toast.notify({
        tone: 'info',
        title: 'No email was sent',
        description: 'Email delivery is not configured for this installation.',
      });
    } else {
      toast.notify({
        tone: 'error',
        title: 'The email could not be delivered',
        description: 'Try again shortly.',
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge tone="warning">Not verified</StatusBadge>
      <Button size="sm" onClick={() => void resend()} loading={pending}>
        Send verification email
      </Button>
    </div>
  );
}

export function ChangePasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get('currentPassword') ?? '');
    const newPassword = String(data.get('newPassword') ?? '');
    const next: FieldErrors = {};
    if (!currentPassword) next.currentPassword = 'Enter your current password.';
    const problem = checkNewPassword(newPassword, String(data.get('confirm') ?? ''));
    if (problem) next.newPassword = problem;
    setErrors(next);
    setMessage(null);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    const result = await apiRequest('POST', '/auth/password/change', {
      body: { currentPassword, newPassword },
      schema: currentUserSchema,
    });
    setPending(false);
    if (result.ok) {
      form.reset();
      toast.notify({
        tone: 'success',
        title: 'Password changed',
        description: 'Your other devices were signed out. This one stays signed in.',
      });
      router.refresh();
      return;
    }
    setErrors(result.fieldErrors);
    if (Object.keys(result.fieldErrors).length === 0) setMessage(describeFailure(result));
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-label="Change password"
      className="flex max-w-md flex-col gap-4"
    >
      {message ? (
        <div role="alert">
          <Notice tone="warning" title="Password not changed">
            {message}
          </Notice>
        </div>
      ) : null}
      <PasswordField
        label="Current password"
        name="currentPassword"
        autoComplete="current-password"
        required
        error={errors.currentPassword}
      />
      <PasswordField
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        hint={PASSWORD_HINT}
        required
        error={errors.newPassword}
      />
      <PasswordField
        label="Repeat new password"
        name="confirm"
        autoComplete="new-password"
        required
      />
      <div>
        <Button type="submit" variant="primary" loading={pending}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export function SessionsList({
  sessions,
  timeZone,
}: {
  sessions: SessionSummary[];
  timeZone: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const revoke = async (id: string) => {
    setBusy(id);
    const result = await apiRequest('DELETE', `/auth/sessions/${id}`, { schema: messageSchema });
    setBusy(null);
    if (result.ok) {
      toast.notify({ tone: 'success', title: 'Session ended' });
      router.refresh();
    } else {
      toast.notify({
        tone: 'error',
        title: 'Could not end the session',
        description: describeFailure(result),
      });
    }
  };

  const revokeOthers = async () => {
    setBusy('others');
    const result = await apiRequest('POST', '/auth/sessions/revoke-others', {
      body: {},
      schema: z.object({ revoked: z.number().int() }),
    });
    setBusy(null);
    if (result.ok) {
      toast.notify({
        tone: 'success',
        title: `Ended ${result.data.revoked} other session${result.data.revoked === 1 ? '' : 's'}`,
      });
      router.refresh();
    } else {
      toast.notify({
        tone: 'error',
        title: 'Could not end other sessions',
        description: describeFailure(result),
      });
    }
  };

  const others = sessions.filter((session) => !session.current).length;
  return (
    <div className="flex flex-col gap-4">
      <DataTable caption="Your signed-in sessions" stacked>
        <thead>
          <tr>
            <Th>Device</Th>
            <Th>Started</Th>
            <Th>Last active</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <Td label="Device">
                <div className="break-words">{session.userAgent ?? 'Unknown device'}</div>
                {session.current ? <StatusBadge tone="positive">This device</StatusBadge> : null}
              </Td>
              <Td label="Started" className="whitespace-nowrap">
                {formatTimestamp(session.createdAt, timeZone)}
              </Td>
              <Td label="Last active" className="whitespace-nowrap">
                {formatTimestamp(session.lastActiveAt, timeZone)}
              </Td>
              <Td label="Actions" className="text-right">
                {session.current ? null : (
                  <Button
                    size="sm"
                    onClick={() => void revoke(session.id)}
                    loading={busy === session.id}
                  >
                    End session
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {others > 0 ? (
        <div>
          <Button onClick={() => void revokeOthers()} loading={busy === 'others'}>
            Sign out of all other devices
          </Button>
        </div>
      ) : (
        <p className="text-meta text-ink-subtle">You are signed in on this device only.</p>
      )}
    </div>
  );
}
