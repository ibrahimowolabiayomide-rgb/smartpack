'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { isModuleActive, modulesInGroup, type NavGroup, type NavModule } from '@/lib/modules';

const GROUP_LABELS: Record<NavGroup, string> = { main: 'Main', secondary: 'Secondary' };

function NavItem({
  module,
  active,
  onNavigate,
}: {
  module: NavModule;
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
        'flex items-center gap-3 rounded-md px-3 py-2 text-ui font-medium pointer-coarse:py-3',
        active
          ? 'bg-nav-raised text-nav-text'
          : 'text-nav-muted hover:bg-nav-raised hover:text-nav-text',
      )}
    >
      <Icon className="shrink-0" />
      <span className="flex-1">{module.label}</span>
      {module.status === 'planned' ? (
        // Truthful status in the navigation itself: the page exists, the capability does not.
        <span className="text-[0.6875rem] font-medium tracking-wider text-nav-dim uppercase">
          Planned<span className="sr-only">, not yet available</span>
        </span>
      ) : null}
    </Link>
  );
}

function NavGroupList({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label={GROUP_LABELS[group]}>
      <ul className="flex flex-col gap-0.5">
        {modulesInGroup(group).map((module) => (
          <li key={module.id}>
            <NavItem
              module={module}
              active={isModuleActive(pathname, module.href)}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The primary and secondary navigation. Every item is a real link to an existing page; modules
 * whose capability is not built yet say "Planned" beside their name. Used by the desktop sidebar
 * and the mobile drawer. The current page is marked with `aria-current`.
 */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-5">
      <NavGroupList group="main" pathname={pathname} onNavigate={onNavigate} />
      <div className="border-t border-nav-line pt-5">
        <NavGroupList group="secondary" pathname={pathname} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
