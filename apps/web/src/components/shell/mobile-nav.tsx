'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Wordmark } from '@/components/brand/wordmark';
import { CloseIcon, MenuIcon } from '@/components/icons';
import { NavList } from './nav-list';

/**
 * Navigation drawer for narrow screens, built on the native <dialog> element.
 *
 * showModal() gives, without custom code: a focus trap, Escape to close, inert page content
 * behind it, and focus returning to the opening button. That is more reliable than a hand-written
 * overlay and needs no extra dependency.
 */
export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  // Close after any navigation (including browser back/forward while the drawer is open).
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className="-ml-2 inline-flex size-10 items-center justify-center rounded-md text-ink hover:bg-sunken active:bg-line lg:hidden"
      >
        <MenuIcon />
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Main navigation"
        onClick={(event) => {
          // A click on the backdrop targets the dialog element itself (the panel fills the box).
          if (event.target === dialogRef.current) close();
        }}
        className="on-dark m-0 h-dvh max-h-none w-80 max-w-[85vw] border-0 bg-nav p-0 text-nav-text backdrop:bg-ink/55 open:flex open:flex-col"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-nav-line pr-2 pl-5">
          <Link href="/" onClick={close} className="rounded-sm" aria-label="SmartPack home">
            <Wordmark />
          </Link>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={close}
            className="inline-flex size-10 items-center justify-center rounded-md text-nav-muted hover:bg-nav-raised hover:text-nav-text"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavList onNavigate={close} />
        </div>
      </dialog>
    </>
  );
}
