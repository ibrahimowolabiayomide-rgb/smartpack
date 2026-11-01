'use client';

import { useState } from 'react';
import { CopyIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Notice } from '@/components/ui/notice';
import { useToast } from '@/components/ui/toast';

/**
 * Opens the diagnostic text in a dialog and lets the person copy it. The text is built on the
 * server from real observations; this component only displays and copies it.
 */
export function DiagnosticsDialog({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const { notify } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      // Close first: a modal dialog makes the rest of the page inert, so a message shown on the
      // page behind it could not be seen or dismissed.
      setOpen(false);
      notify({
        tone: 'success',
        title: 'Diagnostics copied',
        description: 'Paste them into your support message.',
      });
    } catch {
      // Report the failure where the person is looking: inside the dialog.
      setCopyFailed(true);
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          setCopyFailed(false);
          setOpen(true);
        }}
      >
        View diagnostic details
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setCopyFailed(false);
        }}
        title="Diagnostic details"
        description="Share this text with whoever supports the platform. It contains no addresses, credentials or company data."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Close</Button>
            <Button variant="primary" onClick={copy}>
              <CopyIcon width={16} height={16} />
              Copy to clipboard
            </Button>
          </>
        }
      >
        {copyFailed ? (
          <div role="alert" className="pb-3">
            <Notice tone="warning" title="Could not copy automatically">
              Select the text below and copy it manually.
            </Notice>
          </div>
        ) : null}
        <pre
          tabIndex={0}
          aria-label="Diagnostic text"
          className="overflow-x-auto rounded-md border border-line bg-ground p-3 font-mono text-meta whitespace-pre-wrap"
        >
          {text}
        </pre>
      </Dialog>
    </>
  );
}
