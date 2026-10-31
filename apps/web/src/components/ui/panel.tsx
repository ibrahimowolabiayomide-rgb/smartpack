import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A bordered content region with its own heading. `headingId` labels the section for screen readers. */
export function Panel({
  title,
  headingId,
  meta,
  children,
  className,
  flush = false,
}: {
  title: string;
  headingId: string;
  /** Right-aligned secondary text in the header, e.g. when the data was fetched. */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Removes the content padding so a table or list can run edge to edge inside the panel. */
  flush?: boolean;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn('rounded-lg border border-line bg-surface', className)}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
        <h2 id={headingId} className="font-serif text-lead font-semibold text-ink">
          {title}
        </h2>
        {meta ? <div className="text-meta text-ink-subtle">{meta}</div> : null}
      </header>
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </section>
  );
}
