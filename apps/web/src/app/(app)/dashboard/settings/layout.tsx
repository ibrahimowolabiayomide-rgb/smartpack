import type { ReactNode } from 'react';
import { ModuleHeader } from '@/features/modules/module-header';
import { SettingsNav, type SettingsNavItem } from '@/features/settings/settings-nav';
import { getSession } from '@/lib/auth/server';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const can = (key: string) => permissions.includes(key);

  const items: SettingsNavItem[] = [{ label: 'Company', href: '/dashboard/settings' }];
  if (can('users.view')) {
    items.push({ label: 'Members', href: '/dashboard/settings/members' });
    items.push({ label: 'Roles', href: '/dashboard/settings/roles' });
  }
  if (can('audit.view')) items.push({ label: 'Audit log', href: '/dashboard/settings/audit' });
  items.push({ label: 'Account and security', href: '/dashboard/settings/security' });

  return (
    <>
      <ModuleHeader moduleId="settings" />
      <SettingsNav items={items} />
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </>
  );
}
