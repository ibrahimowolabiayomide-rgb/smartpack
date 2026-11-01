import type { Route } from 'next';
import type { ComponentType } from 'react';
import {
  AlertsIcon,
  CustodyIcon,
  HelpIcon,
  InspectionsIcon,
  OverviewIcon,
  PackIcon,
  ReportsIcon,
  SettingsIcon,
  TrackingIcon,
  VerificationIcon,
  WorkersIcon,
  type IconProps,
} from '@/components/icons';

/**
 * `available`: the page exists and everything it shows is real.
 * `planned`: the page exists to fix its place in the product, but the capability it describes is
 * built in a later phase. Such a page contains no records and no working controls.
 */
export type ModuleStatus = 'available' | 'planned';
export type NavGroup = 'main' | 'secondary';

export interface NavModule {
  id: string;
  label: string;
  /** One line taken from the product objectives; says what the module is for, not that it works. */
  description: string;
  icon: ComponentType<IconProps>;
  status: ModuleStatus;
  group: NavGroup;
  href: Route;
  /** Delivery phase (1 to 10) in which the capability is built. Absent once it is `available`. */
  phase?: number;
  /** The backend capability the page waits for, in plain words. Absent once it is `available`. */
  requires?: string;
}

/**
 * The navigation registry: the single list that drives the sidebar, the mobile drawer, breadcrumbs
 * and the capability tables. Every entry has a real route (a test checks that the page file
 * exists). Promoting a module means editing its entry: set `status` to `available` and remove
 * `phase` and `requires`.
 */
export const NAV_MODULES: readonly NavModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Service status now; operational summary once the modules exist.',
    icon: OverviewIcon,
    status: 'available',
    group: 'main',
    href: '/dashboard',
  },
  {
    id: 'smartpacks',
    label: 'SmartPacks',
    description: 'Register every backpack and give it a unique identity and QR code.',
    icon: PackIcon,
    status: 'planned',
    group: 'main',
    href: '/dashboard/smartpacks',
    phase: 4,
    requires: 'The SmartPacks API and asset tables',
  },
  {
    id: 'workers',
    label: 'Workers',
    description: 'Manage workers and know who currently holds each bag.',
    icon: WorkersIcon,
    status: 'planned',
    group: 'main',
    href: '/dashboard/workers',
    phase: 5,
    requires: 'The Workers API and worker accounts',
  },
  {
    id: 'verification',
    label: 'Verification',
    description: 'Verify physical bags using QR codes and photographs.',
    icon: VerificationIcon,
    status: 'planned',
    group: 'main',
    href: '/dashboard/verification',
    phase: 6,
    requires: 'QR identities, camera access and photo storage',
  },
  {
    id: 'tracking',
    label: 'Tracking',
    description: 'Locate bags using the available GPS sources.',
    icon: TrackingIcon,
    status: 'planned',
    group: 'main',
    href: '/dashboard/tracking',
    phase: 7,
    requires: 'An authorised location source and the location history API',
  },
  {
    id: 'custody',
    label: 'Custody & Handover',
    description: 'Record every custody transfer between workers.',
    icon: CustodyIcon,
    status: 'planned',
    group: 'main',
    href: '/dashboard/custody',
    phase: 5,
    requires: 'Workers, SmartPacks and the custody ledger',
  },
  {
    id: 'inspections',
    label: 'Inspections',
    description: 'Record bag condition and inspection history.',
    icon: InspectionsIcon,
    status: 'planned',
    group: 'main',
    href: '/dashboard/inspections',
    phase: 6,
    requires: 'SmartPacks, inspector accounts and photo storage',
  },
  {
    id: 'alerts',
    label: 'Alerts & Incidents',
    description: 'Detect and report unauthorized access or usage.',
    icon: AlertsIcon,
    status: 'planned',
    group: 'main',
    href: '/dashboard/alerts',
    phase: 8,
    requires: 'Security monitoring rules and the incidents API',
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Give administrators complete visibility of company assets.',
    icon: ReportsIcon,
    status: 'planned',
    group: 'main',
    href: '/dashboard/reports',
    phase: 9,
    requires: 'Recorded business data and the reporting API',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Company, users, roles and platform administration.',
    icon: SettingsIcon,
    status: 'planned',
    group: 'secondary',
    href: '/dashboard/settings',
    phase: 3,
    requires: 'Authentication, user accounts and role permissions',
  },
  {
    id: 'help',
    label: 'Help & Documentation',
    description: 'What this build contains, how to read its states, and diagnostics.',
    icon: HelpIcon,
    status: 'available',
    group: 'secondary',
    href: '/dashboard/help',
  },
];

export function modulesInGroup(group: NavGroup): readonly NavModule[] {
  return NAV_MODULES.filter((entry) => entry.group === group);
}

export function getModule(id: string): NavModule {
  const found = NAV_MODULES.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown navigation module "${id}".`);
  return found;
}

/**
 * Whether `pathname` belongs to the module with this `href`. Overview owns only its own page,
 * because every other route also begins with `/dashboard`.
 */
export function isModuleActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Capabilities of this build, each checkable. Used by the landing page and the Help page. A line
 * appears here only if it is implemented and covered by an automated test or a documented check.
 */
export const IMPLEMENTED_CAPABILITIES: readonly {
  id: string;
  label: string;
  description: string;
}[] = [
  {
    id: 'shell',
    label: 'Application shell and design system',
    description: 'Responsive navigation, layouts, design tokens and reusable interface components.',
  },
  {
    id: 'api',
    label: 'API foundation',
    description: 'Versioned REST API with validation, error handling and a live health endpoint.',
  },
  {
    id: 'database',
    label: 'Database foundation',
    description: 'PostgreSQL connection, migrations and PostGIS enabled.',
  },
  {
    id: 'integration',
    label: 'Web to API connection',
    description: 'A server-side API client with timeouts, error handling and request IDs.',
  },
];
