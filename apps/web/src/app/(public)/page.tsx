import { ButtonLink } from '@/components/ui/button';
import { DataTable, Td, Th } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { IMPLEMENTED_CAPABILITIES, NAV_MODULES } from '@/lib/modules';

const STEPS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Register',
    text: 'Every SmartPack backpack is entered in the system and receives a unique identity and QR code.',
  },
  {
    title: 'Scan and photograph',
    text: 'An authorised worker scans the QR code and photographs the physical bag as evidence.',
  },
  {
    title: 'Verify',
    text: 'The company checks that the bag in hand matches its registered record.',
  },
  {
    title: 'Assign',
    text: 'The system records which worker holds the bag, and every transfer between workers.',
  },
  {
    title: 'Inspect',
    text: 'Condition and inspection history are kept against each bag.',
  },
  {
    title: 'Locate and review',
    text: 'Location from an authorised GPS source, together with alerts and incidents, lets management investigate problems.',
  },
];

const plannedModules = NAV_MODULES.filter(
  (entry) => entry.status === 'planned' && entry.group === 'main',
);

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-16 py-10 lg:gap-24 lg:py-16">
      <section className="flex max-w-3xl flex-col items-start gap-6" aria-labelledby="hero-heading">
        <p className="text-meta font-semibold tracking-wider text-accent-text uppercase">
          Asset Intelligence Platform
        </p>
        <h1
          id="hero-heading"
          className="font-serif text-display font-semibold tracking-tight text-balance"
        >
          Know where every SmartPack is, and who has it.
        </h1>
        <p className="max-w-2xl text-lead text-ink-muted">
          SmartPack is the company platform for registering, identifying, verifying and tracking its
          backpacks, with a record of every custody transfer, every inspection and every incident.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/login" variant="primary">
            Sign in
          </ButtonLink>
          <ButtonLink href="/dashboard" variant="secondary">
            Open the application preview
          </ButtonLink>
        </div>
        <p className="max-w-xl text-meta text-ink-subtle">
          Sign-in and the business modules are not available in this build, and the preview contains
          no company data.
        </p>
      </section>

      <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div className="flex flex-col gap-3">
            <h2 id="how-heading" className="font-serif text-title font-semibold tracking-tight">
              Asset control, from the factory floor to the field
            </h2>
            <p className="text-ui text-ink-muted">
              Asset intelligence here means one reliable answer to four questions about each
              backpack: which one it is, whether the physical bag matches its record, who is
              accountable for it, and where it was last known to be.
            </p>
            <p className="text-ui text-ink-muted">
              A QR code identifies a bag and a photograph is evidence for a person to review.
              Neither one reports location, which needs an authorised phone-based GPS source or
              compatible GPS hardware.
            </p>
          </div>
          <ol className="flex flex-col border-t border-line-strong">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 border-b border-line py-4"
              >
                <span className="font-mono text-meta text-ink-subtle" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="flex flex-col gap-0.5">
                  <h3 className="font-medium text-ink">{step.title}</h3>
                  <p className="text-meta text-ink-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="build-status"
        aria-labelledby="status-heading"
        className="flex scroll-mt-20 flex-col gap-5"
      >
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 id="status-heading" className="font-serif text-title font-semibold tracking-tight">
            What this build contains
          </h2>
          <p className="text-ui text-ink-muted">
            The platform is built in ten controlled phases. This table separates what works today
            from what is still to come.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface">
          <DataTable flush caption="Implemented capabilities and planned modules">
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
              {plannedModules.map((module) => (
                <tr key={module.id}>
                  <Td className="font-medium">{module.label}</Td>
                  <Td className="hidden text-ink-muted sm:table-cell">{module.description}</Td>
                  <Td>
                    <StatusBadge tone="neutral">Planned for Phase {module.phase}</StatusBadge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </section>
    </div>
  );
}
