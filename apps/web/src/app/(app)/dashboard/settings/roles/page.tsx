import { permissionSchema, roleSchema } from '@smartpack/shared';
import type { Metadata } from 'next';
import { z } from 'zod';
import { DataTable, Td, Th } from '@/components/ui/data-table';
import { Panel } from '@/components/ui/panel';
import { holds, LoadFailure, NoAccess } from '@/features/settings/access';
import { authedGet } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'Roles and permissions' };

const CATEGORY_LABELS: Record<string, string> = {
  organization: 'Company',
  users: 'People and access',
  assets: 'SmartPack assets',
  workers: 'Workers',
  verifications: 'Verification',
  tracking: 'Tracking',
  custody: 'Custody',
  inspections: 'Inspections',
  alerts: 'Alerts and incidents',
  reports: 'Reports',
  audit: 'Audit',
};

export default async function RolesPage() {
  if (!(await holds('users.view'))) return <NoAccess what="The roles overview" />;
  const [roles, permissions] = await Promise.all([
    authedGet('/organizations/current/roles', z.object({ items: z.array(roleSchema) })),
    authedGet('/organizations/current/permissions', z.object({ items: z.array(permissionSchema) })),
  ]);
  if (roles.kind !== 'ok') return <LoadFailure failure={roles} what="Roles" />;
  if (permissions.kind !== 'ok') return <LoadFailure failure={permissions} what="Permissions" />;

  const sortedRoles = [...roles.data.items].sort((a, b) => a.rank - b.rank);
  const categories = [...new Set(permissions.data.items.map((p) => p.category))];
  const held = new Map(sortedRoles.map((role) => [role.key, new Set(role.permissions)]));

  return (
    <>
      <Panel title="Roles" headingId="roles-heading">
        <p className="pb-4 text-ui text-ink-muted">
          Access comes from a person&apos;s role in this company. Roles are fixed in this version:
          they cannot be edited or created yet. You can give someone a role only if you hold every
          permission it carries, so nobody can hand out more access than they have.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {sortedRoles.map((role) => (
            <li key={role.key} className="rounded-md border border-line p-4">
              <h3 className="text-ui font-semibold">{role.name}</h3>
              <p className="pt-1 text-meta text-ink-muted">{role.description}</p>
              <p className="pt-2 text-meta text-ink-subtle">
                {role.permissions.length} permissions
                {role.assignable ? '' : ' · you cannot assign this role'}
              </p>
              {/* The matrix below needs about 1400px of window width; on narrower screens each role lists its own permissions. */}
              <details className="pt-2 text-meta min-[1401px]:hidden">
                <summary className="cursor-pointer py-1 font-medium text-ink pointer-coarse:py-2.5">
                  Show permissions
                </summary>
                <ul className="flex flex-col gap-1 pt-1">
                  {role.permissions.map((key) => (
                    <li key={key} className="font-mono break-all text-ink-muted">
                      {key}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Permission matrix"
        headingId="matrix-heading"
        flush
        className="max-[1400px]:hidden"
      >
        <DataTable caption="Which role holds which permission" flush>
          <thead>
            <tr>
              <Th>Permission</Th>
              {sortedRoles.map((role) => (
                <Th key={role.key} className="px-2 text-center tracking-normal normal-case">
                  {role.name}
                </Th>
              ))}
            </tr>
          </thead>
          {categories.map((category) => (
            <tbody key={category}>
              <tr className="bg-sunken">
                <th
                  colSpan={sortedRoles.length + 1}
                  scope="colgroup"
                  className="px-4 py-2 text-left text-meta font-semibold text-ink-muted"
                >
                  {CATEGORY_LABELS[category] ?? category}
                </th>
              </tr>
              {permissions.data.items
                .filter((permission) => permission.category === category)
                .map((permission) => (
                  <tr key={permission.key}>
                    <Td>
                      <div className="font-mono text-meta">{permission.key}</div>
                      <div className="text-meta text-ink-muted">{permission.description}</div>
                    </Td>
                    {sortedRoles.map((role) => {
                      const yes = held.get(role.key)?.has(permission.key) ?? false;
                      return (
                        <Td key={role.key} className="px-2 text-center tracking-normal normal-case">
                          {yes ? (
                            <span className="font-semibold text-accent-text">Yes</span>
                          ) : (
                            <span className="text-ink-subtle">No</span>
                          )}
                        </Td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
