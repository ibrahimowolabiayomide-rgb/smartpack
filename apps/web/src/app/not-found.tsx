import { Wordmark } from '@/components/brand/wordmark';
import { ButtonLink } from '@/components/ui/button';
import { getBrandConfig } from '@/lib/brand/server';

export default async function NotFound() {
  const brand = await getBrandConfig();
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 outline-none"
    >
      <Wordmark logoSrc={brand.logoSrc} />
      <div className="flex flex-col gap-2">
        <p className="font-mono text-meta text-ink-subtle">404</p>
        <h1 className="font-serif text-title font-semibold tracking-tight">Page not found</h1>
        <p className="text-ui text-ink-muted">
          This address does not exist. Use the navigation to reach a page, or go back to the
          overview.
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
