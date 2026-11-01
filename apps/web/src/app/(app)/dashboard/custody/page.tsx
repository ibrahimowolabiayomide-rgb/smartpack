import type { Metadata } from 'next';
import { Panel } from '@/components/ui/panel';
import { RecordsView } from '@/components/ui/records-view';
import { Tabs } from '@/components/ui/tabs';
import { UnavailableState } from '@/components/ui/unavailable-state';
import { ModuleHeader } from '@/features/modules/module-header';
import { plannedColumns } from '@/features/modules/planned-columns';
import { getModule } from '@/lib/modules';

export const metadata: Metadata = { title: 'Custody & Handover' };

function CustodyRecords({
  caption,
  columns,
  title,
  description,
  phase,
  requires,
}: {
  caption: string;
  columns: readonly string[];
  title: string;
  description: string;
  phase: number;
  requires: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface">
      <RecordsView
        caption={caption}
        columns={plannedColumns(columns)}
        rows={[]}
        getRowKey={() => ''}
        empty={
          <UnavailableState
            title={title}
            description={description}
            phase={phase}
            requires={requires}
          />
        }
      />
    </div>
  );
}

export default function CustodyPage() {
  const { phase, requires } = getModule('custody');
  const planned = phase ?? 5;
  const dependency = requires ?? '';
  return (
    <>
      <ModuleHeader moduleId="custody" />
      <Panel title="Custody records" headingId="custody-records-heading">
        <Tabs
          label="Custody views"
          tabs={[
            {
              id: 'current',
              label: 'Current custody',
              content: (
                <CustodyRecords
                  caption="Current custody (no records)"
                  columns={['SmartPack', 'Current custodian', 'Previous custodian', 'Held since']}
                  title="No custody is recorded"
                  description="Who holds each SmartPack now, and who held it before, will be shown here. No custodian has been assigned to any bag."
                  phase={planned}
                  requires={dependency}
                />
              ),
            },
            {
              id: 'handovers',
              label: 'Handover records',
              content: (
                <CustodyRecords
                  caption="Handover records (no records)"
                  columns={['Handover time', 'SmartPack', 'From', 'To', 'Approval', 'Approved by']}
                  title="No handovers are recorded"
                  description="Every transfer between workers, with its approval, will be listed here. Handover approval is not built yet."
                  phase={planned}
                  requires={dependency}
                />
              ),
            },
            {
              id: 'history',
              label: 'Assignment history',
              content: (
                <CustodyRecords
                  caption="Assignment history (no records)"
                  columns={['SmartPack', 'Custodian', 'From', 'Until', 'Recorded by']}
                  title="No assignment history exists"
                  description="The full accountability trail for each SmartPack, in time order, will be kept here."
                  phase={planned}
                  requires={dependency}
                />
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}
