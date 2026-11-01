'use client';

import { useCallback, useEffect, useRef, type MouseEvent } from 'react';

/**
 * Shared behaviour of Dialog and Drawer, built on the native <dialog> element.
 *
 * `showModal()` supplies what a hand-written overlay usually gets wrong: a focus trap, inert page
 * content behind the dialog, Escape to close, and focus returning to the control that opened it.
 *
 * The component is controlled: `open` is the source of truth. Closing by any route (Escape, the
 * backdrop, a button) ends in the native `close` event, which reports back through `onOpenChange`.
 */
export function useModalDialog(open: boolean, onOpenChange: (open: boolean) => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // A control marked data-autofocus gets initial focus (React's autoFocus cannot, because the
      // dialog is not displayed when it mounts).
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Runs when the dialog closes for any reason.
  const onClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  // A click whose target is the <dialog> itself landed on the backdrop, because the visible panel
  // fills the dialog's box.
  const onBackdropClick = useCallback((event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) ref.current?.close();
  }, []);

  return { ref, onClose, onBackdropClick };
}
