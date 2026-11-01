import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Notice } from '@/components/ui/notice';
import { PageTitle } from '@/components/ui/page-title';
import { StatusBadge } from '@/components/ui/status-badge';
import { getModule } from '@/lib/modules';

/**
 * Breadcrumbs, the page's single h1, and a statement of whether the module exists. For a planned
 * module the statement names the phase and what it depends on, so a page that shows structure
 * can never be mistaken for a working one.
 */
export function ModuleHeader({
  moduleId,
  actions,
  children,
}: {
  moduleId: string;
  /** Controls beside the title. Unavailable ones must be disabled. */
  actions?: ReactNode;
  /** Extra notices shown with the status statement. */
  children?: ReactNode;
}) {
  const entry = getModule(moduleId);
  const planned = entry.status === 'planned';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Overview', href: '/dashboard' }, { label: entry.label }]} />
        <PageTitle
          title={entry.label}
          description={entry.description}
          actions={
            <>
              {planned ? (
                <StatusBadge tone="neutral">Planned for Phase {entry.phase}</StatusBadge>
              ) : null}
              {actions}
            </>
          }
        />
      </div>
      {planned ? (
        <Notice tone="info" title="Not available in this build">
          This module is planned for Phase {entry.phase} and depends on: {entry.requires}. Until
          then this page shows how its records will be organised. It holds no records, and every
          control that would act on them is switched off.
        </Notice>
      ) : null}
      {children}
    </div>
  );
}
