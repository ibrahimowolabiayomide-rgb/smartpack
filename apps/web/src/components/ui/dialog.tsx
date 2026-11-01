'use client';

import { useId, type ReactNode } from 'react';
import { CloseIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { useModalDialog } from './use-modal-dialog';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Action row. Primary action last. */
  footer?: ReactNode;
  size?: 'sm' | 'md';
}

/**
 * A modal dialog. Not rendered visibly until `open`; labelled by its title and, when given, its
 * description. Escape, the close button and a click on the backdrop all close it.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  const { ref, onClose, onBackdropClick } = useModalDialog(open, onOpenChange);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={onBackdropClick}
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden rounded-lg border border-line-strong',
        'bg-surface p-0 text-ink backdrop:bg-ink/55 open:flex open:flex-col',
        size === 'sm' ? 'max-w-md' : 'max-w-xl',
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="font-serif text-lead font-semibold">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="text-ui text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={() => onOpenChange(false)}
          className="-mt-1 -mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
        >
          <CloseIcon />
        </button>
      </header>
      {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
      {footer ? (
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-ground px-5 py-3">
          {footer}
        </footer>
      ) : null}
    </dialog>
  );
}
