'use client';

import { Button } from './button';
import { Dialog } from './dialog';
import { Notice } from './notice';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Say what will happen and whether it can be undone. */
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Shows a busy state on the confirm button while the action runs. */
  pending?: boolean;
  /** Why the action failed, shown inside the dialog so the person can retry or cancel. */
  error?: string;
}

/**
 * Asks before something consequential happens. Cancel is the first control in the focus order and
 * receives initial focus (`data-autofocus`), so pressing Enter by reflex never confirms.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  pending = false,
  error,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" data-autofocus onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant="primary" loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error ? (
        <div role="alert">
          <Notice tone="warning" title="Not completed">
            {error}
          </Notice>
        </div>
      ) : null}
    </Dialog>
  );
}
