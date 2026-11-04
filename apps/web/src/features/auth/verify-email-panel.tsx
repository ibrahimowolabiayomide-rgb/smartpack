'use client';

import { useEffect, useState } from 'react';
import { messageSchema } from '@smartpack/shared';
import { Notice } from '@/components/ui/notice';
import { ButtonLink } from '@/components/ui/button';
import { apiRequest, describeFailure } from '@/lib/api/browser';
import { useFragmentToken } from '@/lib/auth/fragment-token';

type Outcome = { state: 'working' } | { state: 'done' } | { state: 'failed'; message: string };

/**
 * A link can be used once. In development React runs effects twice, so the request is shared per
 * token: the second run reuses the first answer instead of spending the link a second time.
 */
const inFlight = new Map<string, ReturnType<typeof run>>();
function run(token: string) {
  return apiRequest('POST', '/auth/email/verify', { body: { token }, schema: messageSchema });
}

export function VerifyEmailPanel() {
  const token = useFragmentToken();
  if (token === undefined) return <p className="text-ui text-ink-muted">Loading…</p>;
  if (token === null) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="warning" title="Could not verify the address">
          This page needs the link from your verification email. Open that link again, or sign in
          and request a new verification email.
        </Notice>
        <ButtonLink href="/login" variant="secondary" className="self-start">
          Go to sign in
        </ButtonLink>
      </div>
    );
  }
  return <VerifyEmail key={token} token={token} />;
}

function VerifyEmail({ token }: { token: string }) {
  const [outcome, setOutcome] = useState<Outcome>({ state: 'working' });

  useEffect(() => {
    let cancelled = false;
    const request = inFlight.get(token) ?? run(token);
    inFlight.set(token, request);
    void request.then((result) => {
      if (cancelled) return;
      if (result.ok) setOutcome({ state: 'done' });
      else
        setOutcome({
          state: 'failed',
          message:
            result.code === 'INVALID_TOKEN'
              ? 'This link has expired or was already used. Sign in and request a new verification email.'
              : describeFailure(result),
        });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (outcome.state === 'working')
    return <p className="text-ui text-ink-muted">Verifying your email address…</p>;
  if (outcome.state === 'failed') {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="warning" title="Could not verify the address">
          {outcome.message}
        </Notice>
        <ButtonLink href="/login" variant="secondary" className="self-start">
          Go to sign in
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4" role="status">
      <Notice tone="info" title="Email address verified">
        Thank you. Your email address is confirmed.
      </Notice>
      <ButtonLink href="/login" variant="primary" className="self-start">
        Go to sign in
      </ButtonLink>
    </div>
  );
}
