'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useModalDialog } from './use-modal-dialog';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name of the drawer. Visible headings belong in `children`. */
  label: string;
  children: ReactNode;
  side?: 'left' | 'right';
  /** Style the drawer for the dark navigation rail (focus ring colour). */
  dark?: boolean;
  className?: string;
}

/** A side sheet on the native <dialog>: the mobile navigation and, later, filter panels. */
export function Drawer({
  open,
  onOpenChange,
  label,
  children,
  side = 'left',
  dark = false,
  className,
}: DrawerProps) {
  const { ref, onClose, onBackdropClick } = useModalDialog(open, onOpenChange);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={onBackdropClick}
      className={cn(
        'm-0 h-dvh max-h-none w-80 max-w-[85vw] border-0 p-0 backdrop:bg-ink/55 open:flex open:flex-col',
        side === 'right' && 'ml-auto',
        dark ? 'on-dark bg-nav text-nav-text' : 'bg-surface text-ink',
        className,
      )}
    >
      {children}
    </dialog>
  );
}
