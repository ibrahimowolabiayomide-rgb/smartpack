import type { ReactNode } from 'react';

/** The page's single h1, with optional lead text and actions. Titles use the serif face. */
export function PageTitle({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex max-w-2xl flex-col gap-1.5">
        <h1 className="font-serif text-title font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="text-ui text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
