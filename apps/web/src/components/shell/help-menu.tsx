'use client';

import { HelpIcon } from '@/components/icons';
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu';

const ITEMS: readonly MenuItem[] = [
  { id: 'help', label: 'Help & Documentation', href: '/dashboard/help' },
  { id: 'diagnostics', label: 'Diagnostics', href: '/dashboard/help#diagnostics' },
  { id: 'privacy', label: 'Privacy', href: '/privacy' },
  { id: 'terms', label: 'Terms', href: '/terms' },
];

/** Help and policy links in one menu, so the header stays light on narrow screens. */
export function HelpMenu() {
  return <DropdownMenu label="Help" icon={<HelpIcon width={18} height={18} />} items={ITEMS} />;
}
