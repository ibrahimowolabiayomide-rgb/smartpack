import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { controlClass, FieldShell, useFieldIds } from './field-shell';

export interface DateFieldProps extends Omit<ComponentProps<'input'>, 'id' | 'type'> {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
}

/**
 * A date input using the browser's native picker, which is accessible and localised. Values are
 * ISO dates (yyyy-mm-dd) regardless of how the browser displays them.
 */
export function DateField({ label, hint, error, id, className, ...props }: DateFieldProps) {
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
      <input
        id={ids.id}
        type="date"
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(controlClass, error ? 'border-danger-text' : 'border-line-strong', className)}
        {...props}
      />
    </FieldShell>
  );
}
