'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { messageSchema } from '@smartpack/shared';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { apiRequest, describeFailure } from '@/lib/api/browser';

/**
 * Asks for a reset link. The answer is the same whether or not the address has an account, so this
 * page cannot be used to find out who has one; the wording says "if".
 */
export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address, such as name@company.com.');
      return;
    }
    setError(null);
    setPending(true);
    const result = await apiRequest('POST', '/auth/password/forgot', {
      body: { email },
      schema: messageSchema,
    });
    setPending(false);
    if (result.ok) setSent(email);
    else setError(describeFailure(result));
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <Notice tone="info" title="Check your email">
          If {sent} belongs to a SmartPack account, a reset link has been sent. The link works once
          and expires within the hour. If nothing arrives, check your spam folder, or ask your
          company administrator.
        </Notice>
        <Link href="/login" className="text-ui underline underline-offset-2">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-label="Request a password reset"
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
    >
      <TextField
        label="Email address"
        type="email"
        name="email"
        autoComplete="username"
        required
        error={error ?? undefined}
      />
      <Button type="submit" variant="primary" loading={pending}>
        Send reset link
      </Button>
      <Link href="/login" className="text-meta text-ink-muted underline underline-offset-2">
        Back to sign in
      </Link>
    </form>
  );
}
