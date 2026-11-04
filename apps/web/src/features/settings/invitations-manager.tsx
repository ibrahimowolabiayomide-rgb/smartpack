'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  invitationSchema,
  invitationWithDeliverySchema,
  type EmailDeliveryStatus,
  type Invitation,
  type RoleSummary,
} from '@smartpack/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, Td, Th } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { SelectField } from '@/components/ui/select-field';
import { StatusBadge } from '@/components/ui/status-badge';
import { TextField } from '@/components/ui/text-field';
import { useToast, type ToastInput } from '@/components/ui/toast';
import { useSession } from '@/features/auth/session-context';
import { apiRequest, describeFailure, type FieldErrors } from '@/lib/api/browser';
import { formatTimestamp } from '@/lib/format';

const STATUS_TONE = {
  pending: 'warning',
  accepted: 'positive',
  revoked: 'neutral',
  expired: 'neutral',
} as const;
const STATUS_LABEL = {
  pending: 'Pending',
  accepted: 'Accepted',
  revoked: 'Revoked',
  expired: 'Expired',
} as const;

/** What the person needs to know about the email, stated honestly. */
export function deliveryToast(
  delivery: EmailDeliveryStatus,
  email: string,
  verb: 'created' | 'resent',
): ToastInput {
  switch (delivery) {
    case 'sent':
      return {
        tone: 'success',
        title: `Invitation ${verb === 'created' ? 'sent' : 'resent'} to ${email}`,
      };
    case 'not_configured':
      return {
        tone: 'info',
        title: `Invitation ${verb}, but no email was sent`,
        description:
          'Email delivery is not configured for this installation, so the invitee has no link yet. See the email setup guide in the documentation.',
      };
    case 'failed':
      return {
        tone: 'error',
        title: `Invitation ${verb}, but the email could not be delivered`,
        description: 'The mail server refused or did not answer. Use Resend to try again.',
      };
  }
}

export function InvitationsManager({
  invitations,
  roles,
  timeZone,
}: {
  invitations: Invitation[];
  roles: RoleSummary[];
  timeZone: string;
}) {
  const { can } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);

  const canInvite = can('users.invite');
  const assignable = roles.filter((role) => role.assignable);
  const defaultRole = assignable.find((role) => role.key === 'worker')?.key ?? assignable[0]?.key;

  const closeInvite = () => {
    setInviteOpen(false);
    setErrors({});
    setMessage(null);
  };

  const onInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const role = String(data.get('role') ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'Enter a valid email address.' });
      return;
    }
    setPending(true);
    setErrors({});
    setMessage(null);
    const result = await apiRequest('POST', '/organizations/current/invitations', {
      body: { email, role },
      schema: invitationWithDeliverySchema,
    });
    setPending(false);
    if (result.ok) {
      toast.notify(deliveryToast(result.data.emailDelivery, email, 'created'));
      closeInvite();
      router.refresh();
    } else {
      setErrors(result.fieldErrors);
      if (Object.keys(result.fieldErrors).length === 0) setMessage(describeFailure(result));
    }
  };

  const resend = async (invitation: Invitation) => {
    const result = await apiRequest(
      'POST',
      `/organizations/current/invitations/${invitation.id}/resend`,
      {
        body: {},
        schema: invitationWithDeliverySchema,
      },
    );
    if (result.ok) {
      toast.notify(deliveryToast(result.data.emailDelivery, invitation.email, 'resent'));
      router.refresh();
    } else {
      toast.notify({
        tone: 'error',
        title: 'Could not resend',
        description: describeFailure(result),
      });
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    setPending(true);
    const result = await apiRequest('DELETE', `/organizations/current/invitations/${revoking.id}`, {
      schema: invitationSchema,
    });
    setPending(false);
    if (result.ok) {
      toast.notify({ tone: 'success', title: `Invitation to ${revoking.email} revoked` });
      setRevoking(null);
      router.refresh();
    } else {
      setMessage(describeFailure(result));
    }
  };

  return (
    <>
      {canInvite ? (
        <div className="flex justify-end px-5 pt-4">
          <Button
            variant="primary"
            onClick={() => setInviteOpen(true)}
            disabled={assignable.length === 0}
          >
            Invite someone
          </Button>
        </div>
      ) : null}

      {invitations.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No invitations yet"
            description="Invite a colleague by email. They receive a one-time link to set their password and join the company."
          />
        </div>
      ) : (
        <div className="pt-4">
          <DataTable caption="Invitations" stacked flush>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Invited by</Th>
                <Th>Expires</Th>
                {canInvite ? <Th className="text-right">Actions</Th> : null}
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <Td label="Email" className="break-all">
                    {invitation.email}
                  </Td>
                  <Td label="Role">{invitation.role.name}</Td>
                  <Td label="Status">
                    <StatusBadge tone={STATUS_TONE[invitation.status]}>
                      {STATUS_LABEL[invitation.status]}
                    </StatusBadge>
                  </Td>
                  <Td label="Invited by">{invitation.invitedBy.displayName}</Td>
                  <Td label="Expires" className="whitespace-nowrap">
                    {formatTimestamp(invitation.expiresAt, timeZone)}
                  </Td>
                  {canInvite ? (
                    <Td label="Actions" className="text-right">
                      {invitation.status === 'pending' ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" onClick={() => void resend(invitation)}>
                            Resend
                          </Button>
                          <Button size="sm" variant="quiet" onClick={() => setRevoking(invitation)}>
                            Revoke
                          </Button>
                        </div>
                      ) : invitation.status === 'expired' ? (
                        <span className="text-meta text-ink-subtle">Invite again to renew</span>
                      ) : null}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => (open ? setInviteOpen(true) : closeInvite())}
        title="Invite someone"
        description="They will get a one-time link by email. It expires and works once."
        size="sm"
        footer={
          <>
            <Button onClick={closeInvite}>Cancel</Button>
            <Button type="submit" form="invite-form" variant="primary" loading={pending}>
              Send invitation
            </Button>
          </>
        }
      >
        <form
          id="invite-form"
          onSubmit={(event) => void onInvite(event)}
          noValidate
          className="flex flex-col gap-4"
        >
          {message ? (
            <div role="alert">
              <Notice tone="warning" title="Invitation not created">
                {message}
              </Notice>
            </div>
          ) : null}
          <TextField
            label="Email address"
            type="email"
            name="email"
            autoComplete="off"
            required
            error={errors.email}
          />
          <SelectField
            label="Role"
            name="role"
            defaultValue={defaultRole}
            options={assignable.map((role) => ({ value: role.key, label: role.name }))}
            hint="You can invite only to roles whose permissions you hold yourself."
            error={errors.role}
          />
        </form>
      </Dialog>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevoking(null);
            setMessage(null);
          }
        }}
        title="Revoke this invitation?"
        description={`${revoking?.email ?? ''} will no longer be able to join with the link they were sent. You can invite them again later.`}
        confirmLabel="Revoke invitation"
        pending={pending}
        error={revoking ? (message ?? undefined) : undefined}
        onConfirm={() => void revoke()}
      />
    </>
  );
}
