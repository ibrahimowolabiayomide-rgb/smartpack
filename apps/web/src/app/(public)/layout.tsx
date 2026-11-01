import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from '@/components/brand/wordmark';
import { ButtonLink } from '@/components/ui/button';
import { APP_VERSION } from '@/lib/app-info';
import { getBrandConfig } from '@/lib/brand/server';

const footerLink =
  'rounded-sm underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-ink';

/** Frame for pages that do not need the signed-in shell: the landing page, sign-in and legal pages. */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const brand = await getBrandConfig();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex h-16 items-center justify-between gap-4 border-b border-line">
        <Link href="/" className="rounded-sm" aria-label="SmartPack home">
          <Wordmark logoSrc={brand.logoSrc} />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/#how-it-works"
            className="hidden rounded-md px-3 py-2 text-ui font-medium text-ink-muted hover:bg-sunken hover:text-ink sm:inline-block"
          >
            How it works
          </Link>
          <Link
            href="/#build-status"
            className="hidden rounded-md px-3 py-2 text-ui font-medium text-ink-muted hover:bg-sunken hover:text-ink sm:inline-block"
          >
            Build status
          </Link>
          <ButtonLink href="/login" variant="primary" size="sm">
            Sign in
          </ButtonLink>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <footer className="flex flex-col gap-3 border-t border-line py-6 text-meta text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <p>SmartPack Asset Intelligence Platform</p>
          {brand.companyName ? <p>{brand.companyName}</p> : null}
        </div>
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/privacy" className={footerLink}>
            Privacy
          </Link>
          <Link href="/terms" className={footerLink}>
            Terms
          </Link>
          <span className="font-mono">Development build v{APP_VERSION}</span>
        </nav>
      </footer>
    </div>
  );
}
