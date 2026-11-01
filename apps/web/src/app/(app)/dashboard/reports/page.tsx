import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { DataTable, Td, Th } from '@/components/ui/data-table';
import { DateField } from '@/components/ui/date-field';
import { FilterBar } from '@/components/ui/filter-bar';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { ModuleHeader } from '@/features/modules/module-header';
import { getModule } from '@/lib/modules';

export const metadata: Metadata = { title: 'Reports' };

const REPORTS: ReadonlyArray<{ name: string; contents: string }> = [
  { name: 'Asset report', contents: 'Every SmartPack with its status, custodian and condition.' },
  { name: 'Worker report', contents: 'Workers with their assignments and activity.' },
  { name: 'Custody report', contents: 'Handovers and the accountability history of each bag.' },
  { name: 'Inspection report', contents: 'Inspection results, conditions and evidence.' },
  { name: 'Location history report', contents: 'Recorded positions of SmartPacks over time.' },
  { name: 'Incident report', contents: 'Incidents, their review and their outcome.' },
];

export default function ReportsPage() {
  const { phase } = getModule('reports');
  return (
    <>
      <ModuleHeader moduleId="reports" />

      <Panel title="Report types" headingId="report-types-heading" flush>
        <DataTable flush caption="Planned report types">
          <thead>
            <tr>
              <Th>Report</Th>
              <Th className="hidden sm:table-cell">Will contain</Th>
              <Th>Availability</Th>
            </tr>
          </thead>
          <tbody>
            {REPORTS.map((report) => (
              <tr key={report.name}>
                <Td className="font-medium">{report.name}</Td>
                <Td className="hidden text-ink-muted sm:table-cell">{report.contents}</Td>
                <Td>
                  <StatusBadge tone="neutral">Planned for Phase {phase}</StatusBadge>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      <Panel title="Export" headingId="report-export-heading" flush>
        <FilterBar
          label="Report period"
          unavailableReason="No report can be produced and no file can be exported, because there is no recorded business data to report on."
        >
          <DateField label="From" name="from" />
          <DateField label="To" name="to" />
        </FilterBar>
        <div className="flex px-5 py-4">
          <Button disabled>Export report</Button>
        </div>
      </Panel>
    </>
  );
}
