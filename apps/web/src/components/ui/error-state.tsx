import type { ReactNode } from 'react';
import { AlertTriangleIcon } from '@/components/icons';

/**
 * Shown when something failed. `detail` is for a safe, human-readable cause (never a stack trace
 * or raw server message); `action` is the recovery step, such as a retry button.
 */
export function ErrorState({
  title,
  description,
  detail,
  action,
}: {
  title: string;
  description: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-danger-text/40 bg-danger-bg px-6 py-6 text-danger-text"
    >
      <AlertTriangleIcon width={26} height={26} />
      <div className="flex max-w-prose flex-col gap-1">
        <h3 className="text-ui font-semibold">{title}</h3>
        <p className="text-ui">{description}</p>
        {detail ? <p className="font-mono text-meta">{detail}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
