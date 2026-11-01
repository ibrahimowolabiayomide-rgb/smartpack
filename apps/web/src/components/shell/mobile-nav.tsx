'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Wordmark } from '@/components/brand/wordmark';
import { CloseIcon, MenuIcon } from '@/components/icons';
import { Drawer } from '@/components/ui/drawer';
import { NavList } from './nav-list';

/**
 * Navigation drawer for screens narrower than the desktop breakpoint. It is the same navigation
 * as the sidebar, in a native-<dialog> drawer (focus trap, Escape, focus return, inert page).
 *
 * "Open" is stored as the path it was opened on, so any navigation, including browser back and
 * forward, closes it without an effect.
 */
export function MobileNav({ logoSrc }: { logoSrc?: string | null }) {
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const close = () => setOpenedOn(null);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-haspopup="dialog"
        onClick={() => setOpenedOn(pathname)}
        className="-ml-2 inline-flex size-11 items-center justify-center rounded-md text-ink hover:bg-sunken active:bg-line lg:hidden"
      >
        <MenuIcon />
      </button>
      <Drawer
        open={open}
        onOpenChange={(next) => (next ? setOpenedOn(pathname) : close())}
        label="Main navigation"
        dark
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-nav-line pr-2 pl-5">
          <Link href="/" onClick={close} className="rounded-sm" aria-label="SmartPack home">
            <Wordmark logoSrc={logoSrc} />
          </Link>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={close}
            className="inline-flex size-11 items-center justify-center rounded-md text-nav-muted hover:bg-nav-raised hover:text-nav-text"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <NavList onNavigate={close} />
        </div>
      </Drawer>
    </>
  );
}
