import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Table wrapper. The scroll region is focusable so keyboard users can scroll a wide table on a
 * narrow screen, and it is named by the caption.
 */
export function DataTable({
  caption,
  children,
  className,
  flush = false,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
  /** Removes the outer border and radius, for a table that fills a bordered container itself. */
  flush?: boolean;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className={cn('overflow-x-auto', !flush && 'rounded-lg border border-line', className)}
    >
      <table className="w-full border-collapse text-left text-ui [&_tbody_tr:not(:last-child)]:border-b [&_tbody_tr]:border-line">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-line bg-sunken px-4 py-2.5 text-meta font-semibold tracking-wide text-ink-muted uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-4 py-3 align-top', className)} {...props} />;
}
