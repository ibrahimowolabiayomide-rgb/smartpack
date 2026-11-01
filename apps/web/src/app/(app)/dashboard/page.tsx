import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { LoadingState } from '@/components/ui/loading-state';
import { PageTitle } from '@/components/ui/page-title';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { UnavailableState } from '@/components/ui/unavailable-state';
import { PlatformStatus } from '@/features/platform-status/platform-status';
import { RefreshStatusButton } from '@/features/platform-status/refresh-status-button';
import { getModule } from '@/lib/modules';

export const metadata: Metadata = { title: 'Overview' };

// The status panel reads live data, so this page must be rendered per request, never at build time.
export const dynamic = 'force-dynamic';

/** Each measure names the module that will supply it. Nothing here is a number, because no module exists. */
const MEASURES: ReadonlyArray<{ label: string; source: string }> = [
  { label: 'Total registered SmartPacks', source: 'smartpacks' },
  { label: 'Active assets', source: 'smartpacks' },
  { label: 'Assets currently assigned', source: 'custody' },
  { label: 'Assets requiring attention', source: 'inspections' },
  { label: 'Assets with verification issues', source: 'verification' },
  { label: 'Asset condition summary', source: 'inspections' },
];

const ACTIVITY_PANELS: ReadonlyArray<{
  id: string;
  title: string;
  moduleId: string;
  description: string;
}> = [
  {
    id: 'recent-activity',
    title: 'Recent operational activity',
    moduleId: 'custody',
    description: 'Handovers, verifications and other recorded events will be listed here.',
  },
  {
    id: 'location-overview',
    title: 'Location overview',
    moduleId: 'tracking',
    description: 'The last known positions of SmartPacks will be summarised here.',
  },
  {
    id: 'open-incidents',
    title: 'Open incidents',
    moduleId: 'alerts',
    description: 'Incidents awaiting review will be listed here.',
  },
  {
    id: 'recent-inspections',
    title: 'Recent inspections',
    moduleId: 'inspections',
    description: 'The latest inspections and their conditions will be listed here.',
  },
];

export default function DashboardPage() {
  return (
    <>
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'SmartPack', href: '/' }, { label: 'Overview' }]} />
        <PageTitle
          title="Overview"
          description="Live service status today. The operational summary below fills in as each module is built; until then it states what is missing instead of showing numbers."
        />
      </div>

      <Panel
        title="Service status"
        headingId="platform-status-heading"
        meta={
          <span className="flex flex-wrap items-center gap-3">
            <span>Live from the API. System status, not business activity.</span>
            <RefreshStatusButton />
          </span>
        }
      >
        <Suspense fallback={<LoadingState label="Checking service status" rows={3} />}>
          <PlatformStatus />
        </Suspense>
      </Panel>

      <Panel title="Asset summary" headingId="asset-summary-heading">
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {MEASURES.map((measure) => {
            const source = getModule(measure.source);
            return (
              <div key={measure.label} className="flex flex-col gap-1">
                <dt className="text-meta text-ink-muted">{measure.label}</dt>
                <dd className="text-ui font-medium text-ink">Not available</dd>
                <dd className="text-meta text-ink-subtle">
                  Needs {source.label} (Phase {source.phase})
                </dd>
              </div>
            );
          })}
        </dl>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        {ACTIVITY_PANELS.map((panel) => {
          const source = getModule(panel.moduleId);
          return (
            <Panel key={panel.id} title={panel.title} headingId={`${panel.id}-heading`}>
              <UnavailableState
                title="Not available"
                description={panel.description}
                phase={source.phase ?? 0}
                requires={source.label}
              />
            </Panel>
          );
        })}
      </div>

      <p className="flex flex-wrap items-center gap-2 text-meta text-ink-subtle">
        <StatusBadge tone="neutral">Note</StatusBadge>
        What each part of this build can and cannot do is listed under Help & Documentation.
      </p>
    </>
  );
}
