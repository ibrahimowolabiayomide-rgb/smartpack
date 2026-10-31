import type { ReactNode } from 'react';
import { InboxIcon } from '@/components/icons';

/**
 * Shown where data will appear but none exists yet. Use it instead of placeholder rows:
 * it tells the truth (nothing here) and says what the user can do about it.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong px-6 py-8">
      <span className="text-ink-subtle">{icon ?? <InboxIcon width={28} height={28} />}</span>
      <div className="flex max-w-prose flex-col gap-1">
        <h3 className="text-ui font-semibold text-ink">{title}</h3>
        <p className="text-ui text-ink-muted">{description}</p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
