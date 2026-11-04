import { AUDIT_CATEGORIES, auditEntrySchema, cursorPageSchema } from '@smartpack/shared';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/components/ui/panel';
import { holds, LoadFailure, NoAccess } from '@/features/settings/access';
import { AuditFilters } from '@/features/settings/audit-filters';
import { AuditViewer } from '@/features/settings/audit-viewer';
import { authedGet, getSession } from '@/lib/auth/server';
import { AUDIT_ACTION_OPTIONS } from '@/lib/audit-labels';

export const metadata: Metadata = { title: 'Audit log' };

type SearchParams = Promise<{ category?: string; action?: string }>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await holds('audit.view'))) return <NoAccess what="The audit log" />;
  const params = await searchParams;
  const category = AUDIT_CATEGORIES.find((value) => value === params.category);
  const action = AUDIT_ACTION_OPTIONS.find((option) => option.value === params.action)?.value;

  const query = new URLSearchParams({ limit: '50' });
  if (category) query.set('category', category);
  if (action) query.set('action', action);

  const [session, result] = await Promise.all([
    getSession(),
    authedGet(`/organizations/current/audit-logs?${query}`, cursorPageSchema(auditEntrySchema)),
  ]);
  const timeZone = session.status === 'authenticated' ? session.user.organization.timeZone : 'UTC';

  return (
    <Panel title="Audit log" headingId="audit-heading" flush>
      <div className="border-b border-line p-4">
        <AuditFilters category={category} action={action} />
      </div>
      {result.kind !== 'ok' ? (
        <div className="p-5">
          <LoadFailure failure={result} what="The audit log" />
        </div>
      ) : result.data.items.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No events match"
            description="Nothing has been recorded for these filters yet."
          />
        </div>
      ) : (
        <AuditViewer
          // Remount when the filters change so the list restarts from the newest event.
          key={query.toString()}
          initial={result.data.items}
          nextCursor={result.data.nextCursor}
          query={query.toString()}
          timeZone={timeZone}
        />
      )}
    </Panel>
  );
}
