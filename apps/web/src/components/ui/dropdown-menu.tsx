'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

export type MenuItem =
  | { id: string; label: string; href: Route; external?: false }
  | { id: string; label: string; onSelect: () => void };

/**
 * A menu button following the WAI-ARIA menu-button pattern. Down/Up arrows move through the
 * items, Home/End jump, Escape closes and returns focus to the button, Tab closes, and a press
 * outside the menu closes it. Items are links (navigation) or actions.
 */
export function DropdownMenu({
  label,
  icon,
  items,
}: {
  /** Visible, accessible name of the trigger. */
  label: string;
  icon?: ReactNode;
  items: readonly MenuItem[];
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  const focusItem = (index: number) => {
    const count = items.length;
    itemRefs.current[(index + count) % count]?.focus();
  };

  // Focus the first item when the menu opens.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  // Close on a press outside.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = itemRefs.current.findIndex((node) => node === document.activeElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(current + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const itemClass =
    'flex w-full items-center rounded-sm px-3 py-2 text-left text-ui text-ink hover:bg-sunken focus-visible:bg-sunken pointer-coarse:py-3';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-transparent px-3 text-ui font-medium text-ink hover:bg-sunken active:bg-line"
      >
        {icon}
        {label}
        <ChevronDownIcon
          width={16}
          height={16}
          className={cn(open && 'rotate-180', 'motion-safe:transition-transform')}
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-line-strong bg-surface p-1"
        >
          {items.map((item, index) =>
            'href' in item ? (
              <Link
                key={item.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                role="menuitem"
                tabIndex={-1}
                href={item.href}
                onClick={() => close(false)}
                className={itemClass}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  close(false);
                  item.onSelect();
                }}
                className={itemClass}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
