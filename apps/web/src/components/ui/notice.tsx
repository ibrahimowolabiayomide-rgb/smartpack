import type { ReactNode } from 'react';
import { AlertTriangleIcon, InfoIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

/** An inline message for the whole page or a section. Use `warning` for limits users must know. */
export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning';
  title: string;
  children: ReactNode;
}) {
  const Icon = tone === 'warning' ? AlertTriangleIcon : InfoIcon;
  return (
    <div
      role="note"
      className={cn(
        'flex gap-3 rounded-lg border px-4 py-3',
        tone === 'warning'
          ? 'border-warn-text/35 bg-warn-bg text-warn-text'
          : 'border-line bg-sunken text-ink',
      )}
    >
      <Icon width={20} height={20} className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold">{title}</p>
        <div className={cn('text-ui', tone === 'info' && 'text-ink-muted')}>{children}</div>
      </div>
    </div>
  );
}
