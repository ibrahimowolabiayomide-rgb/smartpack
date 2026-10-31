import type { Route } from 'next';
import type { ComponentType } from 'react';
import {
  AlertsIcon,
  CustodyIcon,
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

export type ModuleStatus = 'available' | 'planned';

export interface NavModule {
  id: string;
  label: string;
  /** One line taken from the product objectives; says what the module is for, not that it works. */
  description: string;
  icon: ComponentType<IconProps>;
  status: ModuleStatus;
  /** Present only when the module has a real page. Planned modules have no route. */
  href?: Route;
}

/**
 * The navigation registry. A module is `available` only when its page exists and works. Planned
 * modules are listed so the product's shape is visible, but they render as inert labels.
 * Promoting a module is a deliberate edit here: set `status` and `href` together.
 */
export const NAV_MODULES: readonly NavModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Platform status and what this build contains.',
    icon: OverviewIcon,
    status: 'available',
    href: '/dashboard',
  },
  {
    id: 'smartpacks',
    label: 'SmartPacks',
    description: 'Register every backpack and give it a unique identity.',
    icon: PackIcon,
    status: 'planned',
  },
  {
    id: 'workers',
    label: 'Workers',
    description: 'Manage workers and know who currently holds each bag.',
    icon: WorkersIcon,
    status: 'planned',
  },
  {
    id: 'verification',
    label: 'Verification',
    description: 'Verify physical bags using QR codes and photographs.',
    icon: VerificationIcon,
    status: 'planned',
  },
  {
    id: 'tracking',
    label: 'Tracking',
    description: 'Locate bags using the available GPS sources.',
    icon: TrackingIcon,
    status: 'planned',
  },
  {
    id: 'custody',
    label: 'Custody',
    description: 'Record every custody transfer between workers.',
    icon: CustodyIcon,
    status: 'planned',
  },
  {
    id: 'inspections',
    label: 'Inspections',
    description: 'Record bag condition and inspection history.',
    icon: InspectionsIcon,
    status: 'planned',
  },
  {
    id: 'alerts',
    label: 'Alerts',
    description: 'Detect and report unauthorized access or usage.',
    icon: AlertsIcon,
    status: 'planned',
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Give administrators complete visibility of company assets.',
    icon: ReportsIcon,
    status: 'planned',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Company and platform administration.',
    icon: SettingsIcon,
    status: 'planned',
  },
];

/** What Phase 1 actually delivers. Each line is verified by an automated test or a documented check. */
export const BUILD_CONTENTS: readonly { id: string; label: string; description: string }[] = [
  {
    id: 'shell',
    label: 'Application shell and design system',
    description: 'Navigation, layout, design tokens and reusable interface components.',
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
];
