export type EmailTemplate =
  | {
      name: 'invitation';
      organizationName: string;
      inviterName: string;
      roleName: string;
      link: string;
      expiresInHours: number;
    }
  | { name: 'email_verification'; link: string; expiresInHours: number }
  | { name: 'password_reset'; link: string; expiresInMinutes: number }
  | { name: 'password_changed'; at: string };

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout(
  heading: string,
  paragraphs: string[],
  action?: { label: string; link: string },
): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join('');
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.link)}" style="background:#1f4d3a;color:#ffffff;padding:12px 20px;border-radius:4px;text-decoration:none;display:inline-block">${escapeHtml(action.label)}</a></p><p style="margin:0 0 16px;color:#57534e;font-size:13px">If the button does not work, copy this address into your browser:<br>${escapeHtml(action.link)}</p>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f2ec;font-family:Arial,Helvetica,sans-serif;color:#1c1917;line-height:1.5"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #d6d1c7;padding:28px"><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>${body}${button}<p style="margin:24px 0 0;color:#57534e;font-size:12px">SmartPack Asset Intelligence Platform</p></div></body></html>`;
}

/** Plain-text first: every message is readable without HTML. Links are the only secret content. */
export function renderEmail(template: EmailTemplate): RenderedEmail {
  switch (template.name) {
    case 'invitation': {
      const intro = `${template.inviterName} has invited you to join ${template.organizationName} on SmartPack as ${template.roleName}.`;
      const expiry = `This invitation expires in ${template.expiresInHours} hours and can be used once.`;
      return {
        subject: `You are invited to join ${template.organizationName} on SmartPack`,
        text: `${intro}\n\nAccept the invitation:\n${template.link}\n\n${expiry}\nIf you did not expect this, ignore this message.`,
        html: layout(
          'You are invited',
          [intro, expiry, 'If you did not expect this, ignore this message.'],
          {
            label: 'Accept invitation',
            link: template.link,
          },
        ),
      };
    }
    case 'email_verification':
      return {
        subject: 'Verify your SmartPack email address',
        text: `Confirm this email address for your SmartPack account:\n${template.link}\n\nThe link expires in ${template.expiresInHours} hours and can be used once.\nIf you did not request this, ignore this message.`,
        html: layout(
          'Verify your email address',
          [
            `The link expires in ${template.expiresInHours} hours and can be used once.`,
            'If you did not request this, ignore this message.',
          ],
          { label: 'Verify email address', link: template.link },
        ),
      };
    case 'password_reset':
      return {
        subject: 'Reset your SmartPack password',
        text: `Someone asked to reset the password for your SmartPack account. If that was you, choose a new password here:\n${template.link}\n\nThe link expires in ${template.expiresInMinutes} minutes and can be used once.\nIf it was not you, ignore this message; your password has not changed.`,
        html: layout(
          'Reset your password',
          [
            'Someone asked to reset the password for your SmartPack account. If that was you, choose a new password.',
            `The link expires in ${template.expiresInMinutes} minutes and can be used once. If it was not you, ignore this message; your password has not changed.`,
          ],
          { label: 'Choose a new password', link: template.link },
        ),
      };
    case 'password_changed':
      return {
        subject: 'Your SmartPack password was changed',
        text: `The password for your SmartPack account was changed on ${template.at}. All other devices were signed out.\n\nIf this was not you, reset your password immediately and tell your company administrator.`,
        html: layout('Your password was changed', [
          `The password for your SmartPack account was changed on ${template.at}. All other devices were signed out.`,
          'If this was not you, reset your password immediately and tell your company administrator.',
        ]),
      };
  }
}
