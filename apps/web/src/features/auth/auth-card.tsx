import type { ReactNode } from 'react';

/** Shared frame for the public, signed-out account pages. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-start justify-center py-10 lg:py-20">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-title font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-ui text-ink-muted">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
