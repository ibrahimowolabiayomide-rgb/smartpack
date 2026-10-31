import type { Route } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { ChevronRightIcon } from '@/components/icons';

export interface BreadcrumbItem {
  label: string;
  /** Omit on the last item: it is the current page and is not a link. */
  href?: Route;
}

/** Location trail. The last item is the current page and is marked with aria-current. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-meta text-ink-subtle">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li>
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="rounded-sm underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-ink"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={isLast ? 'font-medium text-ink' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast ? (
                <li aria-hidden="true" className="flex items-center">
                  <ChevronRightIcon width={12} height={12} />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
