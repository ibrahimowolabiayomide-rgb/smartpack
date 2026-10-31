import type { Metadata } from 'next';
import { ButtonLink, Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { StatusBadge } from '@/components/ui/status-badge';
import { TextField } from '@/components/ui/text-field';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Development placeholder. Authentication is not implemented in Phase 1, so this form is
 * deliberately inert: every control is disabled and there is no submit handler. It exists to fix
 * the page's place in the navigation and to exercise the form components.
 */
export default function LoginPage() {
  return (
    <div className="flex flex-1 items-start justify-center py-12 lg:py-20">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-serif text-title font-semibold tracking-tight">Sign in</h1>
            <StatusBadge tone="neutral">Not available</StatusBadge>
          </div>
          <p className="text-ui text-ink-muted">
            Access for administrators and workers will be added together with authentication.
          </p>
        </div>

        <Notice tone="warning" title="Sign-in is not implemented in this build">
          This page is a development placeholder. Nothing you type here is sent anywhere.
        </Notice>

        <form
          aria-label="Sign in (unavailable)"
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
        >
          <fieldset disabled className="flex flex-col gap-4">
            <legend className="sr-only">Sign-in details (unavailable)</legend>
            <TextField label="Email address" type="email" name="email" autoComplete="username" />
            <TextField
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
            />
          </fieldset>
          <Button type="submit" variant="primary" disabled>
            Sign in
          </Button>
        </form>

        <ButtonLink href="/dashboard" variant="quiet" className="-ml-4 self-start">
          Continue to the development preview
        </ButtonLink>
      </div>
    </div>
  );
}
