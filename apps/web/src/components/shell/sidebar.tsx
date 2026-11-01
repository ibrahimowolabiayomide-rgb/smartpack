import Link from 'next/link';
import { Wordmark } from '@/components/brand/wordmark';
import { APP_VERSION } from '@/lib/app-info';
import type { PublicBrand } from '@/lib/brand/config';
import { NavList } from './nav-list';

/** Desktop navigation rail. Hidden below the `lg` breakpoint, where the drawer takes over. */
export function Sidebar({ brand }: { brand: PublicBrand }) {
  return (
    <aside className="on-dark hidden h-dvh w-64 shrink-0 flex-col border-r border-nav-line bg-nav text-nav-text lg:sticky lg:top-0 lg:flex">
      <div className="flex h-14 items-center border-b border-nav-line px-5">
        <Link href="/" className="rounded-sm" aria-label="SmartPack home">
          <Wordmark logoSrc={brand.logoSrc} />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <NavList />
      </div>
      <div className="border-t border-nav-line px-5 py-4 text-meta text-nav-dim">
        {brand.companyName ? <p className="text-nav-muted">{brand.companyName}</p> : null}
        <p>Development build</p>
        <p className="font-mono">v{APP_VERSION}</p>
      </div>
    </aside>
  );
}
