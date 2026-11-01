import type { Metadata } from 'next';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { SelectField } from '@/components/ui/select-field';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, Td, Th } from '@/components/ui/data-table';
import { ListWorkspace } from '@/features/modules/list-workspace';
import { ModuleHeader } from '@/features/modules/module-header';
import { getModule } from '@/lib/modules';

export const metadata: Metadata = { title: 'Alerts & Incidents' };

const CATEGORIES: ReadonlyArray<{ name: string; covers: string }> = [
  { name: 'Security alerts', covers: 'Events that suggest a bag or the platform is at risk.' },
  {
    name: 'Missing asset incidents',
    covers: 'A registered SmartPack that cannot be accounted for.',
  },
  { name: 'Unauthorized activity', covers: 'Access or use by someone who is not the custodian.' },
  { name: 'Verification problems', covers: 'Verifications that fail or cannot be completed.' },
  {
    name: 'Location anomalies',
    covers: 'Positions that contradict the expected custody or route.',
  },
];

export default function AlertsPage() {
  const { phase, requires } = getModule('alerts');
  return (
    <>
      <ModuleHeader moduleId="alerts">
        <Notice tone="warning" title="Security monitoring is not active">
          Nothing is evaluating activity and no alert or incident can be raised. An empty list here
          does not mean that nothing has happened.
        </Notice>
      </ModuleHeader>

      <Panel title="Alert categories" headingId="alert-categories-heading" flush>
        <DataTable flush caption="Alert categories and their monitoring status">
          <thead>
            <tr>
              <Th>Category</Th>
              <Th className="hidden sm:table-cell">Will cover</Th>
              <Th>Monitoring</Th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((category) => (
              <tr key={category.name}>
                <Td className="font-medium">{category.name}</Td>
                <Td className="hidden text-ink-muted sm:table-cell">{category.covers}</Td>
                <Td>
                  <StatusBadge tone="neutral">Not active</StatusBadge>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      <ListWorkspace
        title="Incidents"
        headingId="incidents-heading"
        filterLabel="Filter incidents"
        columns={[
          'Opened',
          'Category',
          'SmartPack',
          'Incident status',
          'Assigned reviewer',
          'Last reviewed',
        ]}
        filters={
          <>
            <SelectField
              label="Category"
              name="category"
              options={[{ value: '', label: 'All categories' }]}
            />
            <SelectField
              label="Incident status"
              name="status"
              options={[{ value: '', label: 'All statuses' }]}
            />
          </>
        }
        basePath="/dashboard/alerts"
        phase={phase ?? 8}
        requires={requires ?? ''}
        unavailableTitle="No incidents exist"
        unavailableDescription="Incidents will be listed here with their category, status and reviewer, and each will be reviewable. Incident management is not built yet."
      />
    </>
  );
}
