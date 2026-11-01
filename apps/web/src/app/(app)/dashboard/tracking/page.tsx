import type { Metadata } from 'next';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { RecordsView } from '@/components/ui/records-view';
import { StatusBadge } from '@/components/ui/status-badge';
import { UnavailableState } from '@/components/ui/unavailable-state';
import { ModuleHeader } from '@/features/modules/module-header';
import { plannedColumns } from '@/features/modules/planned-columns';
import { getModule } from '@/lib/modules';

export const metadata: Metadata = { title: 'Tracking' };

const SOURCE_FACTS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Tracking status', value: 'Not active' },
  { label: 'Last location update', value: 'None received' },
  { label: 'Phone GPS source', value: 'Not configured' },
  { label: 'GPS hardware source', value: 'Not configured' },
];

export default function TrackingPage() {
  const { phase, requires } = getModule('tracking');
  const planned = phase ?? 7;
  return (
    <>
      <ModuleHeader moduleId="tracking">
        <Notice tone="warning" title="Location tracking is not running">
          A QR code does not provide location, and a photograph does not prove where a bag is.
          Tracking needs an authorised phone-based GPS source or compatible GPS hardware. Neither is
          connected, so no position is shown and none is being collected.
        </Notice>
      </ModuleHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Map" headingId="tracking-map-heading">
          <div className="flex min-h-72 items-center justify-center rounded-md border border-dashed border-line-strong bg-sunken p-6">
            <UnavailableState
              title="No map is displayed"
              description="Asset positions will appear on a map here once a location source is connected. This area is intentionally blank: no coordinates are shown because none exist."
              phase={planned}
              requires={requires}
            />
          </div>
        </Panel>

        <Panel title="Location sources" headingId="tracking-sources-heading">
          <dl className="flex flex-col">
            {SOURCE_FACTS.map((fact) => (
              <div
                key={fact.label}
                className="flex items-center justify-between gap-4 border-b border-line py-2.5 first:pt-0 last:border-b-0 last:pb-0"
              >
                <dt className="text-ink-muted">{fact.label}</dt>
                <dd>
                  <StatusBadge tone="neutral">{fact.value}</StatusBadge>
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel title="Location history" headingId="tracking-history-heading" flush>
        <RecordsView
          caption="Location history (no records)"
          columns={plannedColumns(['Recorded at', 'SmartPack', 'Position', 'Accuracy', 'Source'])}
          rows={[]}
          getRowKey={() => ''}
          empty={
            <UnavailableState
              title="No location history exists"
              description="Each position a source reports will be kept here with its time, accuracy and where it came from."
              phase={planned}
            />
          }
        />
      </Panel>
    </>
  );
}
