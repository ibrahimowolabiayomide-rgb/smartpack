import type { Metadata } from 'next';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { UnavailableState } from '@/components/ui/unavailable-state';
import { ModuleHeader } from '@/features/modules/module-header';
import { getBrandConfig } from '@/lib/brand/server';

export const metadata: Metadata = { title: 'Settings' };

interface Section {
  id: string;
  title: string;
  purpose: string;
  /** Free text so a section can span phases honestly. */
  delivery: string;
  /** The first phase in `delivery`, used by the unavailable state. */
  phase: number;
}

const SECTIONS: readonly Section[] = [
  {
    id: 'company-profile',
    title: 'Company profile',
    purpose: 'The company name, logo and details shown across the platform.',
    delivery: 'Editing in Phase 3',
    phase: 3,
  },
  {
    id: 'application-preferences',
    title: 'Application preferences',
    purpose: 'Display and behaviour choices for each person.',
    delivery: 'Phase 3',
    phase: 3,
  },
  {
    id: 'notification-preferences',
    title: 'Notification preferences',
    purpose: 'Which alerts and incidents notify whom, and how.',
    delivery: 'Phase 8',
    phase: 8,
  },
  {
    id: 'security-settings',
    title: 'Security settings',
    purpose: 'Sign-in policy, session limits and access review.',
    delivery: 'Phase 3',
    phase: 3,
  },
  {
    id: 'user-management',
    title: 'User management',
    purpose: 'Create, suspend and review administrator and worker accounts.',
    delivery: 'Phase 3',
    phase: 3,
  },
  {
    id: 'roles-and-permissions',
    title: 'Roles and permissions',
    purpose: 'What each role may see and do.',
    delivery: 'Phase 3',
    phase: 3,
  },
  {
    id: 'integrations',
    title: 'Integration configuration',
    purpose: 'GPS sources and other connections to outside systems.',
    delivery: 'GPS sources in Phase 7, other integrations in Phase 9',
    phase: 7,
  },
  {
    id: 'data-management',
    title: 'Data management',
    purpose: 'Exports, retention and backup of company data.',
    delivery: 'Phase 9 and Phase 10',
    phase: 9,
  },
];

export default async function SettingsPage() {
  const brand = await getBrandConfig();
  const profileRows: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Company name', value: brand.companyName ?? 'Not configured' },
    { label: 'Logo', value: brand.logoSrc ? 'Custom logo in use' : 'SmartPack mark (default)' },
    {
      label: 'Accent colour',
      value: brand.accent ? brand.accent.accent : 'SmartPack green (default)',
    },
  ];

  return (
    <>
      <ModuleHeader moduleId="settings">
        <Notice tone="warning" title="This page is not access-controlled yet">
          Settings will require an elevated role once authentication exists (Phase 3). Until then
          anyone who can reach this address can open the page, so it shows no sensitive
          configuration and offers no control that changes anything.
        </Notice>
      </ModuleHeader>

      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:flex-col lg:gap-1">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-block rounded-sm py-1 text-ui text-ink-muted underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-ink"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          {SECTIONS.map((section) =>
            section.id === 'company-profile' ? (
              <div key={section.id} id={section.id} className="scroll-mt-20">
                <Panel
                  title={section.title}
                  headingId={`${section.id}-heading`}
                  meta={<StatusBadge tone="neutral">Read-only</StatusBadge>}
                >
                  <div className="flex flex-col gap-4">
                    <p className="text-ui text-ink-muted">{section.purpose}</p>
                    <dl className="flex flex-col">
                      {profileRows.map((row) => (
                        <div
                          key={row.label}
                          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2.5 first:border-t"
                        >
                          <dt className="text-ink-muted">{row.label}</dt>
                          <dd className="text-ink">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-meta text-ink-subtle">
                      These values are read from the web server&apos;s environment
                      (BRAND_COMPANY_NAME, BRAND_LOGO_URL, BRAND_ACCENT_COLOR) and change when the
                      server is restarted, with no rebuild. No official company identity or contact
                      details have been supplied.
                    </p>
                    {brand.warnings.length > 0 ? (
                      <Notice tone="warning" title="Some branding values were ignored">
                        <ul className="list-disc pl-5">
                          {brand.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </Notice>
                    ) : null}
                  </div>
                </Panel>
              </div>
            ) : (
              <div key={section.id} id={section.id} className="scroll-mt-20">
                <Panel title={section.title} headingId={`${section.id}-heading`}>
                  <UnavailableState
                    title="Not available"
                    description={section.purpose}
                    phase={section.phase}
                  />
                  <p className="pt-3 text-meta text-ink-subtle">
                    Planned delivery: {section.delivery}.
                  </p>
                </Panel>
              </div>
            ),
          )}
        </div>
      </div>
    </>
  );
}
