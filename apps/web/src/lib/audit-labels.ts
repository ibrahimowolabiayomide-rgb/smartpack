/** Plain-language names for audit event codes. Unknown codes are shown as they are, never hidden. */
const LABELS: Record<string, string> = {
  'system.bootstrap': 'Company created by the setup command',
  'auth.login.succeeded': 'Signed in',
  'auth.login.failed': 'Failed sign-in attempt',
  'auth.logout': 'Signed out',
  'auth.logout_all': 'Signed out of all devices',
  'auth.password.changed': 'Password changed',
  'auth.password_change.failed': 'Password change refused (wrong current password)',
  'auth.password_reset.requested': 'Password reset requested',
  'auth.password_reset.completed': 'Password reset completed',
  'auth.session.revoked': 'A session was ended',
  'auth.sessions.revoked_others': 'Other sessions were ended',
  'account.email.verification_requested': 'Email verification requested',
  'account.email.verified': 'Email address verified',
  'organization.updated': 'Company profile updated',
  'member.profile_updated': 'Member profile updated',
  'membership.created': 'Member joined',
  'membership.reactivated': 'Member reactivated',
  'membership.suspended': 'Member suspended',
  'membership.removed': 'Member removed',
  'membership.role_changed': 'Member role changed',
  'invitation.created': 'Invitation created',
  'invitation.resent': 'Invitation resent',
  'invitation.revoked': 'Invitation revoked',
  'invitation.accepted': 'Invitation accepted',
  'invitation.accept.failed': 'Invitation acceptance failed',
};

export function describeAuditAction(action: string): string {
  return LABELS[action] ?? action;
}

export const AUDIT_ACTION_OPTIONS = Object.entries(LABELS)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** `key: value` pairs for the details column; arrays are joined, objects are skipped. */
export function summariseMetadata(metadata: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) out.push(`${key}: ${value.join(', ')}`);
    else if (typeof value === 'object') continue;
    else out.push(`${key}: ${String(value)}`);
  }
  return out;
}
