'use client';

import { useState, type ComponentProps } from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { controlClass, FieldShell, useFieldIds } from './field-shell';

export interface PasswordFieldProps extends Omit<ComponentProps<'input'>, 'id' | 'type'> {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
}

/**
 * A password input with a visibility toggle. The toggle is a real button (reachable by keyboard,
 * `aria-pressed` reports its state) and changes only the input type, so the value is never
 * copied anywhere else.
 */
export function PasswordField({ label, hint, error, id, className, ...props }: PasswordFieldProps) {
  const ids = useFieldIds(id, hint, error);
  const [visible, setVisible] = useState(false);
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
        <input
          id={ids.id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          // Some browsers and extensions treat a visible password as free text; keep them out.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            controlClass,
            'pr-12',
            error ? 'border-danger-text' : 'border-line-strong',
            className,
          )}
          {...props}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-controls={ids.id}
          aria-label={visible ? 'Hide password' : 'Show password'}
          disabled={props.disabled}
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-ink-muted hover:text-ink disabled:pointer-events-none disabled:opacity-55"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </FieldShell>
  );
}
