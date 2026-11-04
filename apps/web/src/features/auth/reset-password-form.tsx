'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { messageSchema } from '@smartpack/shared';
import { Button, ButtonLink } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PasswordField } from '@/components/ui/password-field';
import { apiRequest, describeFailure } from '@/lib/api/browser';
import { useFragmentToken } from '@/lib/auth/fragment-token';
import { checkNewPassword, PASSWORD_HINT } from './password-rules';

export function ResetPasswordForm() {
  const token = useFragmentToken();
  if (token === undefined) return <p className="text-ui text-ink-muted">Loading…</p>;
  if (token === null) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="warning" title="This link is not valid">
          The reset link is incomplete. Open the link from your email again, or request a new one.
        </Notice>
        <ButtonLink href="/forgot-password" variant="secondary" className="self-start">
          Request a new link
        </ButtonLink>
      </div>
    );
  }
  return <ChooseNewPassword key={token} token={token} />;
}

function ChooseNewPassword({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <Notice tone="info" title="Password updated">
          Every device was signed out. Sign in with your new password.
        </Notice>
        <ButtonLink href="/login" variant="primary" className="self-start">
          Go to sign in
        </ButtonLink>
      </div>
    );
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    const problem = checkNewPassword(password, String(data.get('confirm') ?? ''));
    setFieldError(problem);
    setError(null);
    if (problem) return;
    setPending(true);
    const result = await apiRequest('POST', '/auth/password/reset', {
      body: { token, newPassword: password },
      schema: messageSchema,
    });
    setPending(false);
    if (result.ok) {
      setDone(true);
    } else if (result.fieldErrors.newPassword) {
      setFieldError(result.fieldErrors.newPassword);
    } else if (result.code === 'INVALID_TOKEN') {
      setError('This link has expired or was already used. Request a new one.');
    } else {
      setError(describeFailure(result));
    }
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-label="Choose a new password"
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
    >
      {error ? (
        <div role="alert">
          <Notice tone="warning" title="Could not update the password">
            {error}{' '}
            <Link href="/forgot-password" className="underline underline-offset-2">
              Request a new link
            </Link>
          </Notice>
        </div>
      ) : null}
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        hint={PASSWORD_HINT}
        required
        error={fieldError}
      />
      <PasswordField
        label="Repeat new password"
        name="confirm"
        autoComplete="new-password"
        required
      />
      <Button type="submit" variant="primary" loading={pending}>
        Update password
      </Button>
    </form>
  );
}
