import type { Route } from 'next';
import Link from 'next/link';
import { buttonStyles } from './button';

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pageSize: number;
  /** Total number of records across all pages. */
  total: number;
  /** Builds the address of a page. Paging is part of the URL, so it survives reload and sharing. */
  hrefForPage: (page: number) => Route;
}

/** Which records the current page shows, as 1-based inclusive numbers. `null` when there are none. */
export function pageRange(page: number, pageSize: number, total: number) {
  if (total <= 0) return null;
  const from = (page - 1) * pageSize + 1;
  return { from, to: Math.min(page * pageSize, total) };
}

/**
 * Previous / next paging with a plain-language position. Edges and the empty case render a
 * disabled control, not a dead link.
 */
export function Pagination({ page, pageSize, total, hrefForPage }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const range = pageRange(page, pageSize, total);
  const hasPrevious = page > 1;
  const hasNext = page < pageCount;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3"
    >
      <p className="text-meta text-ink-muted">
        {range ? `Showing ${range.from} to ${range.to} of ${total}` : 'No records to page through'}
      </p>
      <div className="flex gap-2">
        {hasPrevious ? (
          <Link href={hrefForPage(page - 1)} rel="prev" className={buttonStyles('secondary', 'sm')}>
            Previous
          </Link>
        ) : (
          <button type="button" disabled className={buttonStyles('secondary', 'sm')}>
            Previous
          </button>
        )}
        {hasNext ? (
          <Link href={hrefForPage(page + 1)} rel="next" className={buttonStyles('secondary', 'sm')}>
            Next
          </Link>
        ) : (
          <button type="button" disabled className={buttonStyles('secondary', 'sm')}>
            Next
          </button>
        )}
      </div>
    </nav>
  );
}
