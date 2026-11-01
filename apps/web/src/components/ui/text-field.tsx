import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { controlClass, FieldShell, useFieldIds } from './field-shell';

export interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string;
  /** Helper text shown under the field. */
  hint?: string;
  /** Validation message. When set the field is marked invalid and the message is announced. */
  error?: string;
  /** Overrides the generated id (useful for stable test selectors). */
  id?: string;
}

/**
 * Label + input + hint + error as one accessible unit: the label is bound to the input, and
 * hint/error text is linked through aria-describedby.
 */
export function TextField({ label, hint, error, id, className, ...props }: TextFieldProps) {
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
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(controlClass, error ? 'border-danger-text' : 'border-line-strong', className)}
        {...props}
      />
    </FieldShell>
  );
}
