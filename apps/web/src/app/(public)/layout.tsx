import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from '@/components/brand/wordmark';
import { APP_VERSION } from '@/lib/app-info';

/** Frame for pages that do not need the signed-in shell: the landing page and sign-in. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex h-16 items-center border-b border-line">
        <Link href="/" className="rounded-sm" aria-label="SmartPack home">
          <Wordmark />
        </Link>
      </header>
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-5 text-meta text-ink-subtle">
        <p>SmartPack Asset Intelligence Platform</p>
        <p className="font-mono">Foundation build v{APP_VERSION}</p>
      </footer>
    </div>
  );
}
