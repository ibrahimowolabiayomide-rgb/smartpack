'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export interface SettingsNavItem {
  label: string;
  href: Route;
}

/** Sub-navigation for the Settings area; shows only the sections the person may open. */
export function SettingsNav({ items }: { items: readonly SettingsNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections">
      <ul className="flex flex-wrap gap-1 border-b border-line">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex items-center border-b-2 px-3 py-2.5 text-ui font-medium pointer-coarse:py-3',
                  active
                    ? 'border-accent text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
