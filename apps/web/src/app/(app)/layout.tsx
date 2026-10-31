import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';

/**
 * Every page in this route group renders inside the application shell. Authentication will wrap
 * this layout in a later phase; until then the group is publicly reachable and labelled as such.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
