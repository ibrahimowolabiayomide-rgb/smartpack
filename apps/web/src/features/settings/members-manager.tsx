'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { memberSchema, type Member, type RoleSummary } from '@smartpack/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, Td, Th } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Notice } from '@/components/ui/notice';
import { SelectField } from '@/components/ui/select-field';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/components/ui/toast';
import { apiRequest, describeFailure } from '@/lib/api/browser';
import { formatDate } from '@/lib/format';
import { useSession } from '@/features/auth/session-context';

type Action =
  | { kind: 'role'; member: Member }
  | { kind: 'suspend'; member: Member }
  | { kind: 'reactivate'; member: Member }
  | { kind: 'remove'; member: Member };

const STATUS_TONE = { active: 'positive', suspended: 'warning', removed: 'neutral' } as const;
const STATUS_LABEL = { active: 'Active', suspended: 'Suspended', removed: 'Removed' } as const;

export function MembersManager({
  members,
  roles,
  timeZone,
}: {
  members: Member[];
  roles: RoleSummary[];
  timeZone: string;
}) {
  const { user, can } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [action, setAction] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = can('organization.transfer_ownership');

  const close = () => {
    setAction(null);
    setError(null);
  };

  const run = async (
    method: 'PATCH' | 'POST' | 'DELETE',
    path: `/${string}`,
    body: unknown,
    success: string,
  ) => {
    setPending(true);
    setError(null);
    const result = await apiRequest(method, path, { body, schema: memberSchema });
    setPending(false);
    if (result.ok) {
      toast.notify({ tone: 'success', title: success });
      close();
      router.refresh();
    } else {
      setError(describeFailure(result));
    }
  };

  const assignable = roles.filter((role) => role.assignable);

  const onRoleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (action?.kind !== 'role') return;
    const role = String(new FormData(event.currentTarget).get('role') ?? '');
    if (role === action.member.role.key) {
      setError('That is already their role.');
      return;
    }
    void run(
      'PATCH',
      `/organizations/current/members/${action.member.id}/role`,
      { role },
      `Role changed for ${action.member.displayName}`,
    );
  };

  return (
    <>
      <DataTable caption="Company members" stacked flush>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Joined</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const self = member.userId === user.user.id;
            // Only an owner may act on an owner; the API enforces this too.
            const protectedOwner = member.role.key === 'owner' && !isOwner;
            const actionable = !self && !protectedOwner && member.status !== 'removed';
            return (
              <tr key={member.id}>
                <Td label="Name">
                  <div className="font-medium">
                    {member.displayName}
                    {self ? <span className="font-normal text-ink-muted"> (you)</span> : null}
                  </div>
                  <div className="break-all text-meta text-ink-muted">{member.email}</div>
                  {!member.emailVerified ? (
                    <div className="text-meta text-warn-text">Email not verified</div>
                  ) : null}
                </Td>
                <Td label="Role">{member.role.name}</Td>
                <Td label="Status">
                  <StatusBadge tone={STATUS_TONE[member.status]}>
                    {STATUS_LABEL[member.status]}
                  </StatusBadge>
                </Td>
                <Td label="Joined" className="whitespace-nowrap">
                  {formatDate(member.joinedAt, timeZone)}
                </Td>
                <Td label="Actions" className="text-right">
                  {actionable ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      {can('roles.manage') ? (
                        <Button size="sm" onClick={() => setAction({ kind: 'role', member })}>
                          Change role
                        </Button>
                      ) : null}
                      {can('users.suspend') && member.status === 'active' ? (
                        <Button size="sm" onClick={() => setAction({ kind: 'suspend', member })}>
                          Suspend
                        </Button>
                      ) : null}
                      {can('users.suspend') && member.status === 'suspended' ? (
                        <Button size="sm" onClick={() => setAction({ kind: 'reactivate', member })}>
                          Reactivate
                        </Button>
                      ) : null}
                      {can('users.suspend') ? (
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() => setAction({ kind: 'remove', member })}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-meta text-ink-subtle">
                      {self ? 'Your own account' : 'No actions available'}
                    </span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>

      <Dialog
        open={action?.kind === 'role'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Change role"
        description={
          action?.kind === 'role'
            ? `${action.member.displayName} (${action.member.email})`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" form="change-role-form" variant="primary" loading={pending}>
              Save role
            </Button>
          </>
        }
      >
        {action?.kind === 'role' ? (
          <form id="change-role-form" onSubmit={onRoleSubmit} className="flex flex-col gap-4">
            {error ? (
              <div role="alert">
                <Notice tone="warning" title="Not changed">
                  {error}
                </Notice>
              </div>
            ) : null}
            <SelectField
              label="Role"
              name="role"
              defaultValue={action.member.role.key}
              options={assignable.map((role) => ({ value: role.key, label: role.name }))}
              hint="You can assign only roles whose permissions you hold yourself. Their open sessions keep working, with the new permissions applied immediately."
            />
          </form>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={action?.kind === 'suspend'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Suspend this member?"
        description={`${action?.member.displayName ?? ''} will be signed out everywhere and cannot sign in until you reactivate them. Their records are kept.`}
        confirmLabel="Suspend"
        pending={pending}
        error={error ?? undefined}
        onConfirm={() => {
          if (action?.kind === 'suspend')
            void run(
              'POST',
              `/organizations/current/members/${action.member.id}/suspend`,
              {},
              `${action.member.displayName} suspended`,
            );
        }}
      />
      <ConfirmDialog
        open={action?.kind === 'reactivate'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Reactivate this member?"
        description={`${action?.member.displayName ?? ''} will be able to sign in again with their existing password and role.`}
        confirmLabel="Reactivate"
        pending={pending}
        error={error ?? undefined}
        onConfirm={() => {
          if (action?.kind === 'reactivate')
            void run(
              'POST',
              `/organizations/current/members/${action.member.id}/reactivate`,
              {},
              `${action.member.displayName} reactivated`,
            );
        }}
      />
      <ConfirmDialog
        open={action?.kind === 'remove'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Remove this member?"
        description={`${action?.member.displayName ?? ''} will be signed out and lose access to the company. Their history stays in the audit log. They can rejoin only through a new invitation.`}
        confirmLabel="Remove member"
        pending={pending}
        error={error ?? undefined}
        onConfirm={() => {
          if (action?.kind === 'remove')
            void run(
              'DELETE',
              `/organizations/current/members/${action.member.id}`,
              undefined,
              `${action.member.displayName} removed`,
            );
        }}
      />
    </>
  );
}
