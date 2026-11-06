import type { RoleKey } from '@smartpack/shared';
import {
  describeHours,
  describeMinutes,
  originOf,
  renderContent,
  type EmailContent,
  type RenderedEmail,
} from './layout.js';
import { ROLE_INVITATION_COPY } from './invitation-roles.js';

export type { RenderedEmail } from './layout.js';

export type EmailTemplate =
  | {
      name: 'invitation';
      organizationName: string;
      inviterName: string;
      /** The role's display name as stored in the database. */
      roleName: string;
      roleKey: RoleKey;
      /** The address the invitation was sent to. */
      recipientEmail: string;
      link: string;
      expiresInHours: number;
      /** True when an existing pending invitation is being sent again with a fresh link. */
      resend?: boolean;
    }
  | {
      name: 'email_verification';
      link: string;
      expiresInHours: number;
      recipientName?: string | undefined;
      recipientEmail: string;
      organizationName?: string | undefined;
    }
  | {
      name: 'password_reset';
      link: string;
      expiresInMinutes: number;
      recipientName?: string | undefined;
      recipientEmail: string;
    }
  | {
      name: 'password_changed';
      /** A human-readable UTC timestamp. */
      at: string;
      recipientName?: string | undefined;
      recipientEmail: string;
      /** `change`: made while signed in. `reset`: made with an emailed reset link. */
      via: 'change' | 'reset';
      /** The page where a new reset can be requested (not a one-time link). */
      resetPageLink: string;
    };

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** "6 November 2026 at 00:10 UTC". UTC is stated outright so no reader has to guess the zone. */
export function formatUtcTimestamp(date: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} at ${two(date.getUTCHours())}:${two(date.getUTCMinutes())} UTC`;
}

const CLOSING = ['Regards,', 'The SmartPack team'];
const NEVER_ASK = 'SmartPack will never ask you for your password by email.';

/** "a Worker", "an Operations Manager". */
function withArticle(roleName: string): string {
  return `${/^[aeiou]/i.test(roleName) ? 'an' : 'a'} ${roleName}`;
}

function greeting(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? `Hello ${trimmed},` : 'Hello,';
}

function invitationContent(t: Extract<EmailTemplate, { name: 'invitation' }>): EmailContent {
  const copy = ROLE_INVITATION_COPY[t.roleKey];
  const org = t.organizationName;
  const inviter = t.inviterName;
  const resend = t.resend === true;
  const expiry = describeHours(t.expiresInHours);

  const intro = resend
    ? [
        `${inviter} has sent your invitation to join ${org} on SmartPack again. Nothing about the invitation has changed: you are still invited as ${withArticle(t.roleName)}, and the details are repeated below so you have everything in one place.`,
        copy.purpose(org),
        `This email contains a new link. The link in any earlier email for this invitation no longer works, and the deadline has been extended from the moment this message was sent.`,
      ]
    : [
        `${inviter} has invited you to join ${org} on SmartPack as ${withArticle(t.roleName)}. SmartPack is the platform ${org} uses to manage its SmartPack backpacks and to keep a clear record of who is responsible for them.`,
        copy.purpose(org),
        `When you accept, you become a member of ${org}'s workspace. Your account is linked to the company, its administrators can see that you are a member and which role you hold, and your activity in SmartPack is recorded in the company's audit log.`,
      ];

  const limitParagraphs = [
    ...(copy.limits ? [copy.limits] : []),
    ...(copy.staged
      ? [
          'Some of these areas are being released in stages. Each one becomes usable for your role as soon as it is available.',
        ]
      : []),
  ];

  return {
    subject: resend ? copy.resendSubject(org) : copy.subject(org, inviter),
    preheader: resend
      ? `A new link for your invitation to ${org}, valid for ${expiry}.`
      : `${inviter} has invited you to ${org} as ${withArticle(t.roleName)}. The invitation is valid for ${expiry}.`,
    heading: resend ? `Your invitation to ${org}, sent again` : copy.heading(org),
    greeting: greeting(undefined),
    intro,
    details: [
      { label: 'Company', value: org },
      { label: 'Your role', value: t.roleName },
      { label: 'Invited by', value: inviter },
      { label: 'Sent to', value: t.recipientEmail },
      { label: 'Valid for', value: expiry },
    ],
    sections: [
      { title: copy.accessTitle, items: copy.access },
      ...(limitParagraphs.length ? [{ title: 'Good to know', paragraphs: limitParagraphs }] : []),
      ...(copy.caution
        ? [{ title: 'Before you accept', paragraphs: [copy.caution(org, inviter)] }]
        : []),
      {
        title: 'How to accept',
        ordered: true,
        items: [
          'Select “Accept invitation” below.',
          `If you already have a SmartPack account, sign in with ${t.recipientEmail}. If you do not, you will be asked for your name and to choose a password.`,
          `Once you have accepted, sign in to SmartPack to start working in ${org}'s workspace.`,
        ],
      },
    ],
    action: { label: 'Accept invitation', link: t.link },
    afterAction: [
      `This link is personal to you and can be used once. It expires in ${expiry}. If it expires before you use it, ask ${inviter} or another administrator at ${org} to send you a new invitation.`,
    ],
    security: {
      title: 'If you were not expecting this invitation',
      paragraphs: [
        `If you do not recognise ${inviter} or ${org}, do not use the link. You can safely ignore this email: the invitation will expire on its own and no account will be created.`,
        `Please do not forward this email. Anyone who has the link could accept the invitation. ${NEVER_ASK}`,
      ],
    },
    closing: CLOSING,
    reason: `You received this email because ${inviter} invited ${t.recipientEmail} to join ${org} on SmartPack.`,
    appUrl: originOf(t.link),
  };
}

function verificationContent(
  t: Extract<EmailTemplate, { name: 'email_verification' }>,
): EmailContent {
  const expiry = describeHours(t.expiresInHours);
  const workspace = t.organizationName ? ` and to ${t.organizationName}'s workspace` : '';
  return {
    subject: 'Welcome to SmartPack: please verify your email address',
    preheader: 'Confirm your email address to complete your account setup.',
    heading: 'Welcome to SmartPack',
    greeting: greeting(t.recipientName),
    intro: [
      `Welcome to SmartPack${workspace}. SmartPack is the platform companies use to manage their SmartPack backpacks and to keep a clear record of who is responsible for each one.`,
      `You are receiving this message because a request was made from your signed-in SmartPack account to verify the email address ${t.recipientEmail}.`,
      'Verifying your address confirms that it belongs to you, and it lets us be sure that account messages, such as password resets and security notices, reach the right person. Please complete this step to finish setting up your account.',
    ],
    sections: [
      {
        title: 'What happens next',
        paragraphs: [
          'Select the button below. SmartPack will open a page confirming that your address has been verified, and you can then carry on where you left off.',
        ],
      },
    ],
    action: { label: 'Verify email address', link: t.link },
    afterAction: [
      `This link can be used once and expires in ${expiry}. If it expires, sign in to SmartPack and request a new verification email.`,
    ],
    security: {
      title: 'If you did not request this',
      paragraphs: [
        'You do not need to do anything. Your address stays unverified and nothing about your account changes. If you were not expecting a SmartPack account at all, please let your company administrator know.',
        `Please do not share this link with anyone. ${NEVER_ASK}`,
      ],
    },
    closing: CLOSING,
    reason: `You received this email because a verification was requested for ${t.recipientEmail} on SmartPack.`,
    appUrl: originOf(t.link),
  };
}

function resetContent(t: Extract<EmailTemplate, { name: 'password_reset' }>): EmailContent {
  const expiry = describeMinutes(t.expiresInMinutes);
  return {
    subject: 'Reset your SmartPack password',
    preheader: `Use this link within ${expiry} to choose a new password.`,
    heading: 'Reset your password',
    greeting: greeting(t.recipientName),
    intro: [
      `We received a request to reset the password for the SmartPack account that uses ${t.recipientEmail}.`,
      'If you made this request, select the button below to choose a new password. For your protection, resetting your password signs you out of SmartPack on every device, so you will need to sign in again with the new password afterwards.',
      'Choose a password that you do not use for any other account.',
    ],
    action: { label: 'Reset password', link: t.link },
    afterAction: [
      `This link can be used once and expires in ${expiry}. If it expires, you can request a new one from the “Forgot password” page of the SmartPack sign-in screen.`,
    ],
    security: {
      title: 'If you did not request a password reset',
      paragraphs: [
        'You can ignore this email. Your password has not been changed and your account remains as it was. Someone may have typed your address by mistake.',
        `If you keep receiving reset emails that you did not ask for, tell your company administrator. Please do not share this link with anyone. ${NEVER_ASK}`,
      ],
    },
    closing: CLOSING,
    reason: `You received this email because a password reset was requested for ${t.recipientEmail} on SmartPack.`,
    appUrl: originOf(t.link),
  };
}

function changedContent(t: Extract<EmailTemplate, { name: 'password_changed' }>): EmailContent {
  const how =
    t.via === 'reset'
      ? 'The change was made using a password-reset link that was sent to this address.'
      : 'The change was made from within the account while it was signed in.';
  const sessions =
    t.via === 'reset'
      ? 'As a precaution, every session on this account was ended, so you will need to sign in again on each device.'
      : 'As a precaution, every other device was signed out. Only the device used to make the change remains signed in.';
  return {
    subject: 'Your SmartPack password has been changed',
    preheader: 'This is a security notice. No action is needed if you made this change.',
    heading: 'Your password has been changed',
    greeting: greeting(t.recipientName),
    intro: [
      `This is a confirmation that the password for your SmartPack account (${t.recipientEmail}) was changed on ${t.at}.`,
      `${how} ${sessions}`,
      'We send this notice every time a password changes, so that you always know when it happens. If you made the change, there is nothing more you need to do.',
    ],
    details: [
      { label: 'Account', value: t.recipientEmail },
      { label: 'Changed on', value: t.at },
    ],
    action: { label: 'Reset my password', link: t.resetPageLink },
    afterAction: ['Use the button only if you did not make this change.'],
    security: {
      title: 'If you did not make this change',
      paragraphs: [
        'Someone else may have access to your account. Reset your password straight away using the button above, which signs every device out again, and then tell your company administrator so that recent activity on the account can be reviewed.',
        `If you can no longer sign in or cannot reach your email account, contact your company administrator. ${NEVER_ASK}`,
      ],
    },
    closing: CLOSING,
    reason: `You received this security notice because the password for ${t.recipientEmail} was changed on SmartPack.`,
    appUrl: originOf(t.resetPageLink),
  };
}

/** Each message is written for its own purpose; nothing is shared except the SmartPack frame. */
export function renderEmail(template: EmailTemplate): RenderedEmail {
  switch (template.name) {
    case 'invitation':
      return renderContent(invitationContent(template));
    case 'email_verification':
      return renderContent(verificationContent(template));
    case 'password_reset':
      return renderContent(resetContent(template));
    case 'password_changed':
      return renderContent(changedContent(template));
  }
}
