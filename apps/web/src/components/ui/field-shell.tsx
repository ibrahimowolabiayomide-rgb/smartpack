import { useId, type ReactNode } from 'react';

/**
 * Ids and descriptions shared by every form control: the label is bound to the control, and hint
 * and error text are linked through aria-describedby, so assistive technology reads them with it.
 */
export function useFieldIds(idOverride?: string, hint?: string, error?: string) {
  const generatedId = useId();
  const id = idOverride ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { id, hintId, errorId, describedBy };
}

export const controlClass =
  'h-10 w-full rounded-md border bg-surface px-3 text-ui text-ink placeholder:text-ink-subtle ' +
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle pointer-coarse:h-11';

export function FieldShell({
  id,
  label,
  hint,
  hintId,
  error,
  errorId,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-meta font-medium text-ink">
        {label}
      </label>
      {children}
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
