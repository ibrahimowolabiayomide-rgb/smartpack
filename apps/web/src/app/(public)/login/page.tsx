import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-start justify-center py-10 lg:py-20">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-serif text-title font-semibold tracking-tight">Sign in</h1>
            <StatusBadge tone="neutral">Not enabled</StatusBadge>
          </div>
          <p className="text-ui text-ink-muted">Company sign-in for administrators and workers.</p>
        </div>

        <Notice tone="warning" title="Sign-in is not enabled in this build">
          Accounts and authentication are built in Phase 3. You can try the form to see how input is
          checked, but nothing you type is sent anywhere and no one is signed in.
        </Notice>

        <LoginForm />

        <ButtonLink href="/dashboard" variant="secondary" className="self-start">
          Open the application preview
        </ButtonLink>
      </div>
    </div>
  );
}
