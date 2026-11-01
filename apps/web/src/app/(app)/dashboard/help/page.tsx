import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { DataTable, Td, Th } from '@/components/ui/data-table';
import { PageTitle } from '@/components/ui/page-title';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { DiagnosticsDialog } from '@/features/diagnostics/diagnostics-dialog';
import { buildDiagnosticsText } from '@/features/diagnostics/diagnostics';
import { PlatformStatusView } from '@/features/platform-status/platform-status-view';
import { getApiHealth } from '@/lib/api/health';
import { APP_VERSION } from '@/lib/app-info';
import { IMPLEMENTED_CAPABILITIES, NAV_MODULES } from '@/lib/modules';

export const metadata: Metadata = { title: 'Help & Documentation' };

// Diagnostics read live data, so this page is rendered per request.
export const dynamic = 'force-dynamic';

const STATE_GUIDE: ReadonlyArray<{
  term: string;
  tone: 'positive' | 'neutral' | 'warning';
  meaning: string;
}> = [
  {
    term: 'Implemented',
    tone: 'positive',
    meaning: 'Built, connected to its real backend and covered by automated tests.',
  },
  {
    term: 'Planned',
    tone: 'neutral',
    meaning:
      'The page exists to fix its place in the product. The capability is built in the phase shown, and the page holds no records.',
  },
  {
    term: 'Not configured',
    tone: 'warning',
    meaning: 'The capability exists but has not been set up, for example a GPS source.',
  },
  {
    term: 'Not available',
    tone: 'neutral',
    meaning: 'A value that cannot be shown because the module that supplies it does not exist yet.',
  },
];

export default async function HelpPage() {
  const health = await getApiHealth();
  const diagnostics = buildDiagnosticsText({
    webVersion: APP_VERSION,
    webMode: process.env.NODE_ENV ?? 'unknown',
    generatedAt: new Date().toISOString(),
    health,
  });

  return (
    <>
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[{ label: 'Overview', href: '/dashboard' }, { label: 'Help & Documentation' }]}
        />
        <PageTitle
          title="Help & Documentation"
          description="What this build contains, how to read what the screens say, and how to report a problem."
        />
      </div>

      <Panel title="How to read the screens" headingId="help-states-heading" flush>
        <DataTable flush caption="Meaning of the status labels">
          <thead>
            <tr>
              <Th>Label</Th>
              <Th>Meaning</Th>
            </tr>
          </thead>
          <tbody>
            {STATE_GUIDE.map((state) => (
              <tr key={state.term}>
                <Td className="whitespace-nowrap">
                  <StatusBadge tone={state.tone}>{state.term}</StatusBadge>
                </Td>
                <Td className="text-ink-muted">{state.meaning}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      <Panel title="Implemented in this build" headingId="help-implemented-heading" flush>
        <DataTable flush caption="Capabilities implemented in this build">
          <thead>
            <tr>
              <Th>Capability</Th>
              <Th className="hidden sm:table-cell">Description</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {IMPLEMENTED_CAPABILITIES.map((item) => (
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

      <Panel title="Modules and when they arrive" headingId="help-modules-heading" flush>
        <DataTable flush caption="Navigation modules, their status and the phase that builds them">
          <thead>
            <tr>
              <Th>Module</Th>
              <Th className="hidden md:table-cell">Depends on</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {NAV_MODULES.map((module) => (
              <tr key={module.id}>
                <Td className="font-medium">
                  <Link
                    href={module.href}
                    className="rounded-sm underline decoration-line-strong underline-offset-2 hover:decoration-ink"
                  >
                    {module.label}
                  </Link>
                </Td>
                <Td className="hidden text-ink-muted md:table-cell">
                  {module.requires ?? 'Nothing further'}
                </Td>
                <Td>
                  {module.status === 'planned' ? (
                    <StatusBadge tone="neutral">Planned for Phase {module.phase}</StatusBadge>
                  ) : (
                    <StatusBadge tone="positive">Implemented</StatusBadge>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      <Panel title="What QR codes, photographs and GPS can show" headingId="help-evidence-heading">
        <div className="flex max-w-prose flex-col gap-3 text-ui text-ink-muted">
          <p>
            <strong className="font-semibold text-ink">A QR code</strong> identifies an asset. It
            does not report where the asset is.
          </p>
          <p>
            <strong className="font-semibold text-ink">A photograph</strong> is visual evidence for
            a person to review. It does not establish location, and it does not by itself prove
            authenticity.
          </p>
          <p>
            <strong className="font-semibold text-ink">Location</strong> needs a GPS source: an
            authorised phone-based source or compatible GPS hardware. None is connected, so this
            build does not track anything.
          </p>
        </div>
      </Panel>

      <div id="diagnostics" className="scroll-mt-20">
        <Panel title="Diagnostics" headingId="help-diagnostics-heading" meta="Live from the API">
          <div className="flex flex-col gap-5">
            <PlatformStatusView result={health} />
            <div>
              <DiagnosticsDialog text={diagnostics} />
            </div>
          </div>
        </Panel>
      </div>

      <p className="text-meta text-ink-subtle">
        Legal pages:{' '}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>{' '}
        and{' '}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
        . Neither has been published yet.
      </p>
    </>
  );
}
