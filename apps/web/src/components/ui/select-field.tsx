import type { ComponentProps } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { controlClass, FieldShell, useFieldIds } from './field-shell';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<ComponentProps<'select'>, 'id' | 'children'> {
  label: string;
  options: readonly SelectOption[];
  hint?: string;
  error?: string;
  id?: string;
}

/** A native <select> (best keyboard, touch and screen-reader support) with the shared field styling. */
export function SelectField({
  label,
  options,
  hint,
  error,
  id,
  className,
  ...props
}: SelectFieldProps) {
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
        <select
          id={ids.id}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cn(
            controlClass,
            'appearance-none pr-10',
            error ? 'border-danger-text' : 'border-line-strong',
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          width={16}
          height={16}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
        />
      </div>
    </FieldShell>
  );
}
