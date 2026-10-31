import { Wordmark } from '@/components/brand/wordmark';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 outline-none"
    >
      <Wordmark />
      <div className="flex flex-col gap-2">
        <p className="font-mono text-meta text-ink-subtle">404</p>
        <h1 className="font-serif text-title font-semibold tracking-tight">Page not found</h1>
        <p className="text-ui text-ink-muted">
          This address does not exist. Modules shown as planned in the navigation have no pages yet.
        </p>
      </div>
      <div>
        <ButtonLink href="/dashboard" variant="primary">
          Go to overview
        </ButtonLink>
      </div>
    </main>
  );
}
