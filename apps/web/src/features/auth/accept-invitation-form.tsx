'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { invitationAcceptedSchema, invitationPreviewSchema } from '@smartpack/shared';
import type { z } from 'zod';
import { Button, ButtonLink } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { apiRequest, describeFailure, type FieldErrors } from '@/lib/api/browser';
import { useFragmentToken } from '@/lib/auth/fragment-token';
import { checkNewPassword, PASSWORD_HINT } from './password-rules';

type Preview = z.infer<typeof invitationPreviewSchema>;
type Load =
  | { state: 'loading' }
  | { state: 'invalid'; message: string }
  | { state: 'ready'; preview: Preview };

const NO_LINK_MESSAGE =
  'This page needs the link from your invitation email. Open that link again, or ask your company administrator to send a new invitation.';

/** Reads the link's token, then hands it to a form that starts fresh for each different token. */
export function AcceptInvitationForm() {
  const token = useFragmentToken();
  if (token === undefined) return <p className="text-ui text-ink-muted">Loading…</p>;
  if (token === null) {
    return (
      <Notice tone="warning" title="This invitation cannot be used">
        {NO_LINK_MESSAGE}
      </Notice>
    );
  }
  return <AcceptInvitation key={token} token={token} />;
}

function AcceptInvitation({ token }: { token: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<{ organizationName: string; email: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void apiRequest('POST', '/invitations/preview', {
      body: { token },
      schema: invitationPreviewSchema,
    }).then((result) => {
      if (cancelled) return;
      if (result.ok) setLoad({ state: 'ready', preview: result.data });
      else
        setLoad({
          state: 'invalid',
          message:
            result.code === 'INVALID_TOKEN'
              ? 'This invitation has expired, was already used, or was withdrawn. Ask your company administrator to send a new one.'
              : describeFailure(result),
        });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (load.state === 'loading')
    return <p className="text-ui text-ink-muted">Checking your invitation…</p>;
  if (load.state === 'invalid') {
    return (
      <Notice tone="warning" title="This invitation cannot be used">
        {load.message}
      </Notice>
    );
  }
  if (accepted) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <Notice tone="info" title={`You have joined ${accepted.organizationName}`}>
          Sign in with {accepted.email} to start.
        </Notice>
        <ButtonLink href="/login" variant="primary" className="self-start">
          Go to sign in
        </ButtonLink>
      </div>
    );
  }

  const { preview } = load;
  const existing = preview.accountExists;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    const next: FieldErrors = {};
    let body: unknown;
    if (existing) {
      if (!password) next.password = 'Enter your current password.';
      body = { token, accountExists: true, password };
    } else {
      const firstName = String(data.get('firstName') ?? '').trim();
      const lastName = String(data.get('lastName') ?? '').trim();
      if (!firstName) next.firstName = 'Enter your first name.';
      if (!lastName) next.lastName = 'Enter your last name.';
      const problem = checkNewPassword(password, String(data.get('confirm') ?? ''));
      if (problem) next.password = problem;
      body = { token, accountExists: false, firstName, lastName, password };
    }
    setErrors(next);
    setMessage(null);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    const result = await apiRequest('POST', '/invitations/accept', {
      body,
      schema: invitationAcceptedSchema,
    });
    setPending(false);
    if (result.ok) {
      setAccepted(result.data);
      return;
    }
    if (Object.keys(result.fieldErrors).length > 0) setErrors(result.fieldErrors);
    if (result.code === 'INVALID_CREDENTIALS')
      setErrors({ password: 'That password is not correct.' });
    else if (result.code === 'INVALID_TOKEN')
      setLoad({ state: 'invalid', message: 'This invitation has expired or was already used.' });
    else if (Object.keys(result.fieldErrors).length === 0) setMessage(describeFailure(result));
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-label="Accept invitation"
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
    >
      <dl className="flex flex-col gap-1 border-b border-line pb-4 text-ui">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Company</dt>
          <dd className="text-right font-medium">{preview.organizationName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Email</dt>
          <dd className="text-right break-all">{preview.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Role</dt>
          <dd className="text-right">{preview.roleName}</dd>
        </div>
      </dl>
      {message ? (
        <div role="alert">
          <Notice tone="warning" title="Could not accept the invitation">
            {message}
          </Notice>
        </div>
      ) : null}
      {existing ? (
        <>
          <p className="text-ui text-ink-muted">
            This email already has a SmartPack account. Enter its current password to add this
            company.
          </p>
          <PasswordField
            label="Current password"
            name="password"
            autoComplete="current-password"
            required
            error={errors.password}
          />
        </>
      ) : (
        <>
          <TextField
            label="First name"
            name="firstName"
            autoComplete="given-name"
            required
            error={errors.firstName}
          />
          <TextField
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            required
            error={errors.lastName}
          />
          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            hint={PASSWORD_HINT}
            required
            error={errors.password}
          />
          <PasswordField
            label="Repeat password"
            name="confirm"
            autoComplete="new-password"
            required
          />
        </>
      )}
      <Button type="submit" variant="primary" loading={pending}>
        Accept invitation
      </Button>
    </form>
  );
}
