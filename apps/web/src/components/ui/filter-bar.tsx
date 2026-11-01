import type { ReactNode } from 'react';
import { InfoIcon } from '@/components/icons';

/**
 * A row of search and filter controls. When the data they would act on does not exist yet, pass
 * `unavailableReason`: every control inside is disabled (natively, through a disabled fieldset)
 * and the reason is shown, so nothing pretends to search records that are not there.
 */
export function FilterBar({
  label,
  children,
  unavailableReason,
}: {
  /** Names the group for assistive technology, e.g. "Filter SmartPacks". */
  label: string;
  children: ReactNode;
  unavailableReason?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-5 py-4">
      <fieldset disabled={Boolean(unavailableReason)} className="min-w-0">
        <legend className="sr-only">{label}</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
          {children}
        </div>
      </fieldset>
      {unavailableReason ? (
        <p className="flex items-start gap-2 text-meta text-ink-subtle">
          <InfoIcon width={16} height={16} className="mt-0.5 shrink-0" />
          {unavailableReason}
        </p>
      ) : null}
    </div>
  );
}
