import { useId, type ComponentProps } from 'react';
import { cn } from '@/lib/cn';

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
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-meta font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-10 w-full rounded-md border bg-surface px-3 text-ui text-ink placeholder:text-ink-subtle',
          'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle',
          error ? 'border-danger-text' : 'border-line-strong',
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-meta text-ink-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-meta font-medium text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
