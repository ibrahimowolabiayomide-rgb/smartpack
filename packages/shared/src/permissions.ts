/**
 * The permission catalogue and the built-in roles.
 *
 * This file is the single TypeScript statement of "who may do what". The database holds the same
 * data (seeded by a migration so the API can query it); an integration test fails if the two ever
 * disagree. Permissions for later phases are defined now so roles do not have to be reshaped when
 * those modules arrive; they grant nothing until the matching endpoints exist.
 */

export const PERMISSION_DEFINITIONS = [
  { key: 'organization.view', category: 'organization', description: 'View the company profile.' },
  {
    key: 'organization.manage',
    category: 'organization',
    description: 'Change company settings.',
  },
  {
    key: 'organization.transfer_ownership',
    category: 'organization',
    description: 'Grant or remove the Owner role. Held by owners only.',
  },
  { key: 'users.invite', category: 'users', description: 'Invite people to the company.' },
  { key: 'users.view', category: 'users', description: 'View company members and invitations.' },
  { key: 'users.update', category: 'users', description: "Edit a member's profile details." },
  {
    key: 'users.suspend',
    category: 'users',
    description: "Suspend, reactivate and remove members' access.",
  },
  { key: 'roles.manage', category: 'users', description: 'Assign roles to members.' },
  { key: 'assets.view', category: 'assets', description: 'View SmartPack asset records.' },
  { key: 'assets.create', category: 'assets', description: 'Register SmartPack assets.' },
  { key: 'assets.update', category: 'assets', description: 'Edit SmartPack asset records.' },
  { key: 'workers.view', category: 'workers', description: 'View worker records.' },
  { key: 'workers.manage', category: 'workers', description: 'Manage worker records.' },
  {
    key: 'verifications.view',
    category: 'verification',
    description: 'View verification records.',
  },
  {
    key: 'verifications.manage',
    category: 'verification',
    description: 'Create and manage verification records.',
  },
  { key: 'tracking.view', category: 'tracking', description: 'View location tracking data.' },
  { key: 'custody.view', category: 'custody', description: 'View custody records.' },
  {
    key: 'custody.manage',
    category: 'custody',
    description: 'Assign assets and record handovers.',
  },
  { key: 'inspections.view', category: 'inspections', description: 'View inspections.' },
  {
    key: 'inspections.manage',
    category: 'inspections',
    description: 'Record and manage inspections.',
  },
  { key: 'alerts.view', category: 'alerts', description: 'View alerts.' },
  { key: 'incidents.manage', category: 'alerts', description: 'Manage security incidents.' },
  { key: 'reports.view', category: 'reports', description: 'View reports.' },
  { key: 'reports.export', category: 'reports', description: 'Export reports.' },
  { key: 'audit.view', category: 'audit', description: 'View the audit log.' },
] as const;

export type PermissionKey = (typeof PERMISSION_DEFINITIONS)[number]['key'];

export const PERMISSION_KEYS = PERMISSION_DEFINITIONS.map<PermissionKey>((p) => p.key);

export const ROLE_KEYS = [
  'owner',
  'admin',
  'operations_manager',
  'asset_manager',
  'supervisor',
  'worker',
  'auditor',
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  /** Lower is more powerful. Used for ordering in lists only; authority comes from permissions. */
  rank: number;
  permissions: readonly PermissionKey[];
}

const withoutOwnership = PERMISSION_KEYS.filter((key) => key !== 'organization.transfer_ownership');

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    key: 'owner',
    name: 'Company Owner',
    description:
      'Primary administrator. Full control of the company, including who else may be an owner.',
    rank: 10,
    permissions: PERMISSION_KEYS,
  },
  {
    key: 'admin',
    name: 'Company Administrator',
    description: 'Administers members, roles and settings. Cannot grant or remove the Owner role.',
    rank: 20,
    permissions: withoutOwnership,
  },
  {
    key: 'operations_manager',
    name: 'Operations Manager',
    description: 'Runs day-to-day operations across assets, workers, custody and reports.',
    rank: 30,
    permissions: [
      'organization.view',
      'users.view',
      'assets.view',
      'assets.create',
      'assets.update',
      'workers.view',
      'workers.manage',
      'verifications.view',
      'verifications.manage',
      'tracking.view',
      'custody.view',
      'custody.manage',
      'inspections.view',
      'inspections.manage',
      'alerts.view',
      'incidents.manage',
      'reports.view',
      'reports.export',
    ],
  },
  {
    key: 'asset_manager',
    name: 'Asset Manager',
    description: 'Maintains SmartPack asset records and their inspection history.',
    rank: 40,
    permissions: [
      'organization.view',
      'assets.view',
      'assets.create',
      'assets.update',
      'verifications.view',
      'tracking.view',
      'custody.view',
      'inspections.view',
      'inspections.manage',
      'reports.view',
    ],
  },
  {
    key: 'supervisor',
    name: 'Supervisor',
    description: 'Oversees workers and their handovers, verifications and inspections.',
    rank: 50,
    permissions: [
      'organization.view',
      'assets.view',
      'workers.view',
      'verifications.view',
      'verifications.manage',
      'tracking.view',
      'custody.view',
      'custody.manage',
      'inspections.view',
      'inspections.manage',
      'alerts.view',
    ],
  },
  {
    key: 'worker',
    name: 'Worker',
    description:
      'Field user. Holds no company-wide data permissions; worker-facing access is added with the modules that need it.',
    rank: 60,
    permissions: ['organization.view'],
  },
  {
    key: 'auditor',
    name: 'Auditor (read-only)',
    description: 'Can review company records and the audit log but cannot change anything.',
    rank: 70,
    permissions: [
      'organization.view',
      'users.view',
      'assets.view',
      'workers.view',
      'verifications.view',
      'tracking.view',
      'custody.view',
      'inspections.view',
      'alerts.view',
      'reports.view',
      'audit.view',
    ],
  },
];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

/**
 * The privilege-escalation rule: a person may assign a role (or act on a member holding it) only
 * if they hold every permission that role carries. An administrator therefore cannot create an
 * owner, and nobody can hand out more than they have.
 */
export function holdsAllPermissions(held: readonly string[], required: readonly string[]): boolean {
  const set = new Set(held);
  return required.every((permission) => set.has(permission));
}
