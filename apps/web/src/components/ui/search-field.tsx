import type { ComponentProps } from 'react';
import { SearchIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { controlClass, FieldShell, useFieldIds } from './field-shell';

export interface SearchFieldProps extends Omit<ComponentProps<'input'>, 'id' | 'type'> {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
}

/** A search input. The label stays visible text; the magnifier is decoration only. */
export function SearchField({ label, hint, error, id, className, ...props }: SearchFieldProps) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldShell
      id={ids.id}
      label={label}
      hint={hint}
      hintId={ids.hintId}
      error={error}
      errorId={ids.errorId}
    >
      <div className="relative">
        <SearchIcon
          width={18}
          height={18}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
        />
        <input
          id={ids.id}
          type="search"
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cn(
            controlClass,
            'pl-10',
            error ? 'border-danger-text' : 'border-line-strong',
            className,
          )}
          {...props}
        />
      </div>
    </FieldShell>
  );
}
