import type { RoleKey } from '@smartpack/shared';

/**
 * What each built-in role means, written for the person being invited.
 *
 * Every statement here is a plain-language reading of the role's permissions in
 * `packages/shared/src/permissions.ts`. `templates.spec.ts` asserts the permission facts these
 * sentences rely on, so a change to a role's permissions fails a test and forces this copy to be
 * reviewed instead of silently becoming inaccurate.
 */
export interface RoleInvitationCopy {
  /** Heading of the invitation, given the company name. */
  heading: (organizationName: string) => string;
  /** Subject of the first invitation. */
  subject: (organizationName: string, inviterName: string) => string;
  /** Subject when the invitation is sent again. */
  resendSubject: (organizationName: string) => string;
  /** What the role is for, one or two sentences. */
  purpose: (organizationName: string) => string;
  accessTitle: string;
  /** What the person will be able to do. */
  access: string[];
  /** What the role does not include, when that is worth saying. */
  limits?: string;
  /** True when the role carries operational permissions whose modules are released in stages. */
  staged: boolean;
  /** Extra caution shown to roles with wide access. */
  caution?: (organizationName: string, inviterName: string) => string;
}

export const ROLE_INVITATION_COPY: Record<RoleKey, RoleInvitationCopy> = {
  owner: {
    heading: (org) => `Join ${org} as a Company Owner`,
    subject: (org, inviter) => `${inviter} has invited you to be an owner of ${org} on SmartPack`,
    resendSubject: (org) =>
      `Your invitation to become an owner of ${org} on SmartPack has been sent again`,
    purpose: (org) =>
      `The Company Owner is the primary administrator of ${org}'s SmartPack workspace and holds the highest level of access in it.`,
    accessTitle: 'What this role allows you to do',
    access: [
      'Change company settings and review the audit log of activity in the workspace.',
      "Invite people to the company, edit their profile details, and suspend, reactivate or remove a member's access.",
      'Assign any role to any member, including the Company Owner role itself.',
      'Use every operational area of SmartPack: assets, workers, verification, location tracking, custody, inspections, alerts, incidents and reports.',
    ],
    staged: true,
    caution: (org, inviter) =>
      `Because this role carries full control of ${org}'s workspace, please accept it only if you were expecting it. If you are unsure, confirm with ${inviter} before using the link.`,
  },
  admin: {
    heading: (org) => `Join ${org} as a Company Administrator`,
    subject: (org, inviter) => `${inviter} has invited you to administer ${org} on SmartPack`,
    resendSubject: (org) => `Your invitation to administer ${org} on SmartPack has been sent again`,
    purpose: (org) =>
      `This is a senior role. Administrators manage who has access to ${org}'s SmartPack workspace and what each person is allowed to do.`,
    accessTitle: 'What this role allows you to do',
    access: [
      'Change company settings and review the audit log of activity in the workspace.',
      "Invite people to the company, edit their profile details, and suspend, reactivate or remove a member's access.",
      'Assign roles to members, with the exception of the Company Owner role.',
      'Use every operational area of SmartPack: assets, workers, verification, location tracking, custody, inspections, alerts, incidents and reports.',
    ],
    limits:
      'Administrators cannot grant or remove the Company Owner role. That remains with the company’s owners.',
    staged: true,
    caution: (org, inviter) =>
      `Because this role carries wide access to ${org}'s workspace, please accept it only if you were expecting it. If you are unsure, confirm with ${inviter} before using the link.`,
  },
  operations_manager: {
    heading: (org) => `Join ${org} as an Operations Manager`,
    subject: (org, inviter) =>
      `${inviter} has invited you to join ${org} on SmartPack as Operations Manager`,
    resendSubject: (org) =>
      `Your invitation to join ${org} on SmartPack as Operations Manager has been sent again`,
    purpose: (org) =>
      `Operations Managers are responsible for the day-to-day running of ${org}'s SmartPack operations.`,
    accessTitle: 'What this role allows you to do',
    access: [
      'View the company profile and its members.',
      'View, register and edit SmartPack asset records.',
      'View and manage worker records.',
      'Create and manage verification records, and view location tracking.',
      'Assign assets to workers and record handovers, and record and manage inspections.',
      'View alerts, manage security incidents, and view and export reports.',
    ],
    limits: 'This role does not include managing members, roles or company settings.',
    staged: true,
  },
  asset_manager: {
    heading: (org) => `Join ${org} as an Asset Manager`,
    subject: (org, inviter) =>
      `${inviter} has invited you to join ${org} on SmartPack as Asset Manager`,
    resendSubject: (org) =>
      `Your invitation to join ${org} on SmartPack as Asset Manager has been sent again`,
    purpose: (org) =>
      `Asset Managers maintain the records of ${org}'s SmartPack backpacks and the history of their inspections.`,
    accessTitle: 'What this role allows you to do',
    access: [
      'View the company profile.',
      'View, register and edit SmartPack asset records.',
      'View, record and manage inspections.',
      'View verification records, location tracking, custody records and reports.',
    ],
    limits: 'This role does not include managing workers, members, roles or company settings.',
    staged: true,
  },
  supervisor: {
    heading: (org) => `Join ${org} as a Supervisor`,
    subject: (org, inviter) =>
      `${inviter} has invited you to join ${org} on SmartPack as Supervisor`,
    resendSubject: (org) =>
      `Your invitation to join ${org} on SmartPack as Supervisor has been sent again`,
    purpose: (org) =>
      `Supervisors oversee ${org}'s workers and the handovers, verifications and inspections they carry out.`,
    accessTitle: 'What this role allows you to do',
    access: [
      'View the company profile, SmartPack asset records and worker records.',
      'View and manage verification records.',
      'Assign assets to workers and record handovers.',
      'View and manage inspections.',
      'View location tracking and alerts.',
    ],
    limits:
      'This role does not include editing asset records, viewing reports, or managing members, roles or company settings.',
    staged: true,
  },
  worker: {
    heading: (org) => `Join the ${org} team on SmartPack`,
    subject: (org, inviter) => `${inviter} has invited you to join ${org} on SmartPack as a worker`,
    resendSubject: (org) =>
      `Your invitation to join ${org} on SmartPack as a worker has been sent again`,
    purpose: (org) =>
      `The Worker role is for field staff. Your account will sit inside ${org}'s workspace, and the role does not give you administrator or owner access.`,
    accessTitle: 'What this role gives you',
    access: [
      "A personal SmartPack account that you can sign in to, linked to your company's workspace.",
      'The ability to view your company’s profile.',
      'Further worker-facing features as they are added to the platform. They will become available to you through your company, and you do not need to prepare anything.',
    ],
    limits:
      'The Worker role does not include access to company settings, member management or company-wide records.',
    staged: false,
  },
  auditor: {
    heading: (org) => `Join ${org} as an Auditor`,
    subject: (org, inviter) =>
      `${inviter} has invited you to join ${org} on SmartPack as a read-only Auditor`,
    resendSubject: (org) =>
      `Your invitation to join ${org} on SmartPack as a read-only Auditor has been sent again`,
    purpose: (org) =>
      `Auditors review ${org}'s SmartPack records and the audit log. The role is strictly read-only.`,
    accessTitle: 'What this role allows you to do',
    access: [
      'View the company profile and its members.',
      'View SmartPack asset records, worker records, verification records, custody records and inspections.',
      'View location tracking, alerts and reports.',
      'Review the audit log of activity in the workspace.',
    ],
    limits: 'The Auditor role cannot create, change or remove anything.',
    staged: true,
  },
};
