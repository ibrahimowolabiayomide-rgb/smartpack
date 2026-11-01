import type { ReactNode } from 'react';
import { StatusBadge } from './status-badge';

/**
 * Shown where a module's records will appear but the module does not exist yet. It is not an
 * "empty" state: nothing is wrong and nothing is being collected. It says which phase delivers the
 * capability and what it depends on, so nobody reads silence as "all clear".
 */
export function UnavailableState({
  title,
  description,
  phase,
  requires,
  action,
}: {
  title: string;
  description: string;
  /** The delivery phase (1 to 10) in which this capability is built. */
  phase: number;
  /** What must exist first, in plain words, e.g. "The SmartPacks API". */
  requires?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong px-6 py-8">
      <StatusBadge tone="neutral">Planned for Phase {phase}</StatusBadge>
      <div className="flex max-w-prose flex-col gap-1">
        <h3 className="text-ui font-semibold text-ink">{title}</h3>
        <p className="text-ui text-ink-muted">{description}</p>
        {requires ? <p className="pt-1 text-meta text-ink-subtle">Depends on: {requires}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
