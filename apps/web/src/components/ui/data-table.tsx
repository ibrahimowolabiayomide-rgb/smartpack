import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * On narrow screens a stacked table shows each row as a block of "label: value" lines instead of
 * columns, so nothing needs sideways scrolling. The column headings stay available to screen
 * readers; every cell carries its own heading as `label`.
 */
const STACKED =
  'max-md:[&_thead]:sr-only max-md:[&_table]:block max-md:[&_tbody]:block max-md:[&_tr]:block max-md:[&_tr]:px-4 max-md:[&_tr]:py-2 max-md:[&_td]:flex max-md:[&_td]:gap-3 max-md:[&_td]:px-0 max-md:[&_td]:py-1.5 max-md:[&_td]:text-left max-md:[&_td]:whitespace-normal';

/**
 * Table wrapper. The scroll region is focusable so keyboard users can scroll a wide table on a
 * narrow screen, and it is named by the caption. Use `stacked` for tables with several columns
 * of real content so they never need that scrolling on a phone.
 */
export function DataTable({
  caption,
  children,
  className,
  flush = false,
  stacked = false,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
  /** Removes the outer border and radius, for a table that fills a bordered container itself. */
  flush?: boolean;
  /** Below the `md` breakpoint, show each row as labelled lines. Every `Td` then needs a `label`. */
  stacked?: boolean;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className={cn(
        'overflow-x-auto',
        !flush && 'rounded-lg border border-line',
        stacked && STACKED,
        className,
      )}
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

/**
 * A table cell. With `label` (the column's heading) the cell can be shown as "label: value" when its
 * table is stacked on a narrow screen.
 */
export function Td({
  className,
  label,
  children,
  ...props
}: ComponentProps<'td'> & { label?: string }) {
  if (label === undefined) {
    return (
      <td className={cn('px-4 py-3 align-top', className)} {...props}>
        {children}
      </td>
    );
  }
  return (
    <td
      data-label={label}
      className={cn(
        'px-4 py-3 align-top max-md:before:w-24 max-md:before:shrink-0 max-md:before:text-meta max-md:before:font-semibold max-md:before:text-ink-muted max-md:before:content-[attr(data-label)]',
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
    </td>
  );
}
