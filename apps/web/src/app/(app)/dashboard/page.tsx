import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { DataTable, Td, Th } from '@/components/ui/data-table';
import { Notice } from '@/components/ui/notice';
import { PageTitle } from '@/components/ui/page-title';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { PlatformStatus } from '@/features/platform-status/platform-status';
import { BUILD_CONTENTS, NAV_MODULES } from '@/lib/modules';

export const metadata: Metadata = { title: 'Overview' };

// The status panel reads live data, so this page must be rendered per request, never at build time.
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const planned = NAV_MODULES.filter((module) => module.status === 'planned');

  return (
    <>
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'SmartPack', href: '/' }, { label: 'Overview' }]} />
        <PageTitle
          title="Overview"
          description="Platform foundation. The business modules listed below are not available yet."
        />
      </div>

      <Notice tone="warning" title="Development preview">
        Authentication is not implemented in this build, so this page is publicly reachable. It
        contains no company data.
      </Notice>

      <Panel title="Platform status" headingId="platform-status-heading" meta="Live from the API">
        <PlatformStatus />
      </Panel>

      <Panel title="Implemented in this build" headingId="implemented-heading" flush>
        <DataTable flush caption="Capabilities implemented in this build">
          <thead>
            <tr>
              <Th>Capability</Th>
              <Th className="hidden sm:table-cell">Description</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {BUILD_CONTENTS.map((item) => (
              <tr key={item.id}>
                <Td className="font-medium">{item.label}</Td>
                <Td className="hidden text-ink-muted sm:table-cell">{item.description}</Td>
                <Td>
                  <StatusBadge tone="positive">Implemented</StatusBadge>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      <Panel title="Planned modules" headingId="planned-heading" flush>
        <DataTable flush caption="Modules planned for later phases">
          <thead>
            <tr>
              <Th>Module</Th>
              <Th className="hidden sm:table-cell">Purpose</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {planned.map((module) => (
              <tr key={module.id}>
                <Td className="font-medium">{module.label}</Td>
                <Td className="hidden text-ink-muted sm:table-cell">{module.description}</Td>
                <Td>
                  <StatusBadge tone="neutral">Not implemented</StatusBadge>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>
    </>
  );
}
