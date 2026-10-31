import { ButtonLink } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { BUILD_CONTENTS, NAV_MODULES } from '@/lib/modules';

const plannedLabels = NAV_MODULES.filter((module) => module.status === 'planned').map(
  (module) => module.label,
);

export default function LandingPage() {
  return (
    <div className="grid flex-1 gap-12 py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-20 lg:py-20">
      <div className="flex flex-col items-start gap-7">
        <p className="text-meta font-semibold tracking-wider text-accent-text uppercase">
          Asset Intelligence Platform
        </p>
        <h1 className="font-serif text-display font-semibold tracking-tight text-balance">
          Know where every SmartPack is, and who has it.
        </h1>
        <p className="max-w-xl text-lead text-ink-muted">
          SmartPack is the company platform for registering, identifying, verifying and tracking its
          backpacks, with a record of every custody transfer.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/dashboard" variant="primary">
            Open development preview
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Sign in
          </ButtonLink>
        </div>
        <p className="max-w-xl text-meta text-ink-subtle">
          Authentication and the business modules are not available in this build. The preview
          contains no company data.
        </p>
      </div>

      <section aria-labelledby="build-status-heading" className="flex flex-col gap-5 lg:pt-3">
        <h2 id="build-status-heading" className="font-serif text-lead font-semibold">
          What this build contains
        </h2>
        <dl className="flex flex-col border-t border-line-strong">
          {BUILD_CONTENTS.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 border-b border-line py-4"
            >
              <div className="flex max-w-md flex-col gap-0.5">
                <dt className="font-medium text-ink">{item.label}</dt>
                <dd className="text-meta text-ink-muted">{item.description}</dd>
              </div>
              <dd>
                <StatusBadge tone="positive">Implemented</StatusBadge>
              </dd>
            </div>
          ))}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 border-b border-line py-4">
            <div className="flex max-w-md flex-col gap-0.5">
              <dt className="font-medium text-ink">Business modules</dt>
              <dd className="text-meta text-ink-muted">{plannedLabels.join(', ')}.</dd>
            </div>
            <dd>
              <StatusBadge tone="neutral">Not implemented</StatusBadge>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
