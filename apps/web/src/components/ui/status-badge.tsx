import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type StatusTone = 'neutral' | 'positive' | 'warning' | 'critical';

const tones: Record<StatusTone, { badge: string; marker: string }> = {
  neutral: { badge: 'bg-neutral-bg text-neutral-text', marker: 'bg-neutral-text' },
  positive: { badge: 'bg-accent-tint text-accent-text', marker: 'bg-accent' },
  warning: { badge: 'bg-warn-bg text-warn-text', marker: 'bg-warn-text' },
  critical: { badge: 'bg-danger-bg text-danger-text', marker: 'bg-danger-text' },
};

/**
 * A short status label. The tone changes colour, but the text always states the status, so
 * meaning never depends on colour alone.
 */
export function StatusBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  const { badge, marker } = tones[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-meta font-medium whitespace-nowrap',
        badge,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-[1px]', marker)} />
      {children}
    </span>
  );
}
