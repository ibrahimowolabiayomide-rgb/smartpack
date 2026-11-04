import { organizationSchema } from '@smartpack/shared';
import type { Metadata } from 'next';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { UnavailableState } from '@/components/ui/unavailable-state';
import { LegacyAnchorRedirect } from '@/features/settings/legacy-anchor-redirect';
import { BrandingDetails } from '@/features/settings/branding-details';
import { CompanyProfileForm } from '@/features/settings/company-profile-form';
import { holds, LoadFailure } from '@/features/settings/access';
import { authedGet } from '@/lib/auth/server';
import { getBrandConfig } from '@/lib/brand/server';

export const metadata: Metadata = { title: 'Settings' };

const LATER_SECTIONS = [
  {
    id: 'notification-preferences',
    title: 'Notification preferences',
    purpose: 'Which alerts and incidents notify whom, and how.',
    delivery: 'Phase 8',
    phase: 8,
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
] as const;

export default async function SettingsPage() {
  const [organization, canManage, brand] = await Promise.all([
    authedGet('/organizations/current', organizationSchema),
    holds('organization.manage'),
    getBrandConfig(),
  ]);

  return (
    <>
      <LegacyAnchorRedirect />
      {organization.kind === 'ok' ? (
        <div id="company-profile" className="scroll-mt-20">
          <Panel
            title="Company profile"
            headingId="company-profile-heading"
            meta={
              <StatusBadge tone={organization.data.status === 'active' ? 'positive' : 'warning'}>
                {organization.data.status === 'active' ? 'Active' : 'Suspended'}
              </StatusBadge>
            }
          >
            <div className="flex flex-col gap-5">
              <dl className="flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y border-line py-2.5">
                  <dt className="text-ink-muted">Company reference</dt>
                  <dd className="font-mono text-ink">{organization.data.slug}</dd>
                </div>
              </dl>
              {canManage ? (
                <CompanyProfileForm organization={organization.data} />
              ) : (
                <dl className="flex flex-col">
                  {[
                    ['Company name', organization.data.name],
                    ['Time zone', organization.data.timeZone],
                    ['Country', organization.data.country ?? 'Not set'],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2.5"
                    >
                      <dt className="text-ink-muted">{label}</dt>
                      <dd className="text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {!canManage ? (
                <p className="text-meta text-ink-subtle">
                  Only people who manage the company can change these details.
                </p>
              ) : null}
              <p className="text-meta text-ink-subtle">
                The company reference identifies the company when one account belongs to several. It
                is fixed at creation.
              </p>
              <BrandingDetails brand={brand} />
            </div>
          </Panel>
        </div>
      ) : (
        <LoadFailure failure={organization} what="The company profile" />
      )}

      {LATER_SECTIONS.map((section) => (
        <div key={section.id} id={section.id} className="scroll-mt-20">
          <Panel title={section.title} headingId={`${section.id}-heading`}>
            <UnavailableState
              title="Not available"
              description={section.purpose}
              phase={section.phase}
            />
            <p className="pt-3 text-meta text-ink-subtle">Planned delivery: {section.delivery}.</p>
          </Panel>
        </div>
      ))}
    </>
  );
}
