'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { NAV_MODULES, type NavModule } from '@/lib/modules';

const itemBase = 'flex items-center gap-3 rounded-md px-3 py-2 text-ui';

function AvailableItem({
  module,
  active,
  onNavigate,
}: {
  module: NavModule & { href: NonNullable<NavModule['href']> };
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = module.icon;
  return (
    <Link
      href={module.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        itemBase,
        'font-medium',
        active
          ? 'bg-nav-raised text-nav-text'
          : 'text-nav-muted hover:bg-nav-raised hover:text-nav-text',
      )}
    >
      <Icon className="shrink-0" />
      {module.label}
    </Link>
  );
}

function PlannedItem({ module }: { module: NavModule }) {
  const Icon = module.icon;
  return (
    // Not a link: the page does not exist yet. aria-disabled + the visible "Planned" tag make
    // that explicit to everyone, and it is skipped by keyboard focus because nothing can be done.
    <span aria-disabled="true" className={cn(itemBase, 'cursor-not-allowed text-nav-dim')}>
      <Icon className="shrink-0" />
      <span className="flex-1">{module.label}</span>
      <span className="text-[0.6875rem] font-medium tracking-wider uppercase">
        <span className="sr-only">(</span>Planned
        <span className="sr-only">, not yet available)</span>
      </span>
    </span>
  );
}

/**
 * The primary navigation list. Available modules are links; planned modules are inert labels.
 * Used by both the desktop sidebar and the mobile drawer.
 */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const available = NAV_MODULES.filter((m) => m.status === 'available');
  const planned = NAV_MODULES.filter((m) => m.status === 'planned');

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="px-3 pb-1 text-[0.6875rem] font-semibold tracking-wider text-nav-dim uppercase">
          Workspace
        </h2>
        <ul className="flex flex-col gap-0.5">
          {available.map((module) =>
            module.href ? (
              <li key={module.id}>
                <AvailableItem
                  module={{ ...module, href: module.href }}
                  active={pathname === module.href}
                  onNavigate={onNavigate}
                />
              </li>
            ) : null,
          )}
        </ul>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="px-3 pb-1 text-[0.6875rem] font-semibold tracking-wider text-nav-dim uppercase">
          Modules
        </h2>
        <ul className="flex flex-col gap-0.5">
          {planned.map((module) => (
            <li key={module.id}>
              <PlannedItem module={module} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
