/**
 * The SmartPack email frame. Every message is described once as structured content and rendered
 * twice from that single description, so the HTML and plain-text versions can never drift apart.
 *
 * The HTML is table-based with inline styles because mail clients (Outlook and Gmail in particular)
 * ignore most modern CSS. One small <style> block adds the phone-width adjustments; clients that
 * drop it still show a correct single-column message.
 */

export interface EmailDetail {
  label: string;
  value: string;
}

export interface EmailSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
  /** Render `items` as a numbered list. */
  ordered?: boolean;
}

export interface EmailContent {
  subject: string;
  /** Short summary shown beside the subject in the inbox list. */
  preheader: string;
  heading: string;
  greeting: string;
  intro: string[];
  details?: EmailDetail[];
  sections?: EmailSection[];
  action?: { label: string; link: string };
  /** Shown straight after the button: expiry and single-use information. */
  afterAction?: string[];
  security: { title: string; paragraphs: string[] };
  closing: string[];
  /** Why this particular message was sent to this particular person. */
  reason: string;
  /** The web application's origin, for the footer link. Omitted when unknown. */
  appUrl?: string | undefined;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const COLOR = {
  page: '#f5f2ec',
  card: '#fdfcf9',
  border: '#d6d1c7',
  ink: '#1c1917',
  muted: '#57534e',
  header: '#1c1917',
  headerMuted: '#a8a29e',
  accent: '#1f4d3a',
  panel: '#f5f2ec',
} as const;

const SERIF = "Georgia,'Times New Roman',Times,serif";
const SANS = "'Segoe UI',Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function paragraph(text: string, style = ''): string {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.65;color:${COLOR.ink};${style}">${escapeHtml(text)}</p>`;
}

function list(items: string[], ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul';
  const rows = items
    .map(
      (item) =>
        `<li style="margin:0 0 8px;font-family:${SANS};font-size:15px;line-height:1.6;color:${COLOR.ink}">${escapeHtml(item)}</li>`,
    )
    .join('');
  return `<${tag} style="margin:0 0 16px;padding-left:22px">${rows}</${tag}>`;
}

function sectionHtml(section: EmailSection): string {
  const title = `<h2 style="margin:28px 0 10px;font-family:${SERIF};font-size:17px;line-height:1.35;font-weight:bold;color:${COLOR.ink}">${escapeHtml(section.title)}</h2>`;
  const paragraphs = (section.paragraphs ?? []).map((p) => paragraph(p)).join('');
  const items = section.items ? list(section.items, section.ordered === true) : '';
  return `${title}${paragraphs}${items}`;
}

function detailsHtml(details: EmailDetail[]): string {
  const rows = details
    .map(
      (row, index) =>
        `<tr><td class="sp-detail-label" valign="top" style="padding:10px 14px;${index > 0 ? `border-top:1px solid ${COLOR.border};` : ''}width:34%;font-family:${SANS};font-size:13px;line-height:1.5;color:${COLOR.muted}">${escapeHtml(row.label)}</td><td valign="top" style="padding:10px 14px;${index > 0 ? `border-top:1px solid ${COLOR.border};` : ''}font-family:${SANS};font-size:14px;line-height:1.5;color:${COLOR.ink};font-weight:bold;word-break:break-word">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;background:${COLOR.panel};border:1px solid ${COLOR.border};border-radius:4px">${rows}</table>`;
}

function buttonHtml(action: { label: string; link: string }): string {
  const href = escapeHtml(action.link);
  return (
    `<table role="presentation" class="sp-button" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 18px"><tr>` +
    `<td align="center" bgcolor="${COLOR.accent}" style="background:${COLOR.accent};border-radius:4px">` +
    `<a href="${href}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:16px;font-weight:bold;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:4px">${escapeHtml(action.label)}</a>` +
    `</td></tr></table>` +
    `<p style="margin:0 0 16px;font-family:${SANS};font-size:13px;line-height:1.6;color:${COLOR.muted}">If the button does not work, copy and paste this address into your browser:<br><a href="${href}" style="color:${COLOR.accent};word-break:break-all">${escapeHtml(action.link)}</a></p>`
  );
}

function securityHtml(security: EmailContent['security']): string {
  const paragraphs = security.paragraphs
    .map((p, index) =>
      paragraph(
        p,
        `font-size:14px;${index === security.paragraphs.length - 1 ? 'margin-bottom:0;' : ''}`,
      ),
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;background:${COLOR.panel};border-left:3px solid ${COLOR.ink}"><tr><td style="padding:16px 18px"><p style="margin:0 0 8px;font-family:${SERIF};font-size:15px;font-weight:bold;color:${COLOR.ink}">${escapeHtml(security.title)}</p>${paragraphs}</td></tr></table>`;
}

const RESPONSIVE_CSS = `
@media only screen and (max-width:620px){
  .sp-container{width:100%!important}
  .sp-pad{padding:26px 20px!important}
  .sp-pad-h{padding:20px!important}
  .sp-button{width:100%!important}
  .sp-button a{display:block!important;padding:15px 12px!important}
  .sp-detail-label{width:38%!important}
}`;

export function renderHtml(content: EmailContent): string {
  const footerLink = content.appUrl
    ? ` <a href="${escapeHtml(content.appUrl)}" style="color:${COLOR.muted};text-decoration:underline">Open SmartPack</a>`
    : '';
  const body = [
    `<h1 style="margin:0 0 20px;font-family:${SERIF};font-size:25px;line-height:1.3;font-weight:bold;color:${COLOR.ink}">${escapeHtml(content.heading)}</h1>`,
    paragraph(content.greeting),
    ...content.intro.map((p) => paragraph(p)),
    content.details ? detailsHtml(content.details) : '',
    ...(content.sections ?? []).map(sectionHtml),
    content.action ? buttonHtml(content.action) : '',
    ...(content.afterAction ?? []).map((p) => paragraph(p)),
    securityHtml(content.security),
    `<div style="margin-top:28px">${content.closing
      .map((line, index) =>
        paragraph(
          line,
          index === content.closing.length - 1
            ? 'margin-bottom:0;font-weight:bold;'
            : 'margin-bottom:4px;',
        ),
      )
      .join('')}</div>`,
  ].join('');

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light">` +
    `<title>${escapeHtml(content.subject)}</title><style>${RESPONSIVE_CSS}</style></head>` +
    `<body style="margin:0;padding:0;background:${COLOR.page};-webkit-text-size-adjust:100%">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.page};mso-hide:all">${escapeHtml(content.preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.page}" style="background:${COLOR.page}"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" class="sp-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">` +
    `<tr><td class="sp-pad-h" bgcolor="${COLOR.header}" style="background:${COLOR.header};padding:22px 32px;border-radius:4px 4px 0 0">` +
    `<div style="font-family:${SERIF};font-size:24px;line-height:1.2;color:${COLOR.page};font-weight:bold">SmartPack</div>` +
    `<div style="margin-top:4px;font-family:${SANS};font-size:11px;line-height:1.4;letter-spacing:1.4px;text-transform:uppercase;color:${COLOR.headerMuted}">Asset Intelligence Platform</div>` +
    `</td></tr>` +
    `<tr><td bgcolor="${COLOR.accent}" height="3" style="background:${COLOR.accent};height:3px;font-size:0;line-height:0">&nbsp;</td></tr>` +
    `<tr><td class="sp-pad" bgcolor="${COLOR.card}" style="background:${COLOR.card};padding:36px 32px;border:1px solid ${COLOR.border};border-top:0;border-radius:0 0 4px 4px">${body}</td></tr>` +
    `<tr><td class="sp-pad-h" style="padding:20px 32px 8px;font-family:${SANS};font-size:12px;line-height:1.65;color:${COLOR.muted}">` +
    `<p style="margin:0 0 8px">${escapeHtml(content.reason)}</p>` +
    `<p style="margin:0">SmartPack Asset Intelligence Platform. This is an automated message.${footerLink}</p>` +
    `</td></tr></table></td></tr></table></body></html>`
  );
}

function textSection(section: EmailSection): string {
  const lines: string[] = [section.title];
  for (const p of section.paragraphs ?? []) lines.push('', p);
  if (section.items) {
    lines.push('');
    section.items.forEach((item, index) =>
      lines.push(section.ordered === true ? `${index + 1}. ${item}` : `- ${item}`),
    );
  }
  return lines.join('\n');
}

export function renderText(content: EmailContent): string {
  const blocks: string[] = [content.greeting, ...content.intro];
  if (content.details) {
    blocks.push(content.details.map((row) => `${row.label}: ${row.value}`).join('\n'));
  }
  for (const section of content.sections ?? []) blocks.push(textSection(section));
  if (content.action) blocks.push(`${content.action.label}:\n${content.action.link}`);
  blocks.push(...(content.afterAction ?? []));
  blocks.push([content.security.title, '', ...content.security.paragraphs].join('\n'));
  blocks.push(content.closing.join('\n'));
  blocks.push(
    [
      '--',
      content.reason,
      'SmartPack Asset Intelligence Platform. This is an automated message.',
      ...(content.appUrl ? [content.appUrl] : []),
    ].join('\n'),
  );
  return `${content.heading}\n${'='.repeat(Math.min(content.heading.length, 60))}\n\n${blocks.join('\n\n')}\n`;
}

export function renderContent(content: EmailContent): RenderedEmail {
  return { subject: content.subject, text: renderText(content), html: renderHtml(content) };
}

/** "72 hours (3 days)", "24 hours (1 day)", "1 hour". Matches the configured token lifetime. */
export function describeHours(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return `${hours} hours (${days} ${days === 1 ? 'day' : 'days'})`;
  }
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** "60 minutes (1 hour)", "30 minutes", "1 minute". */
export function describeMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${minutes} minutes (${hours} ${hours === 1 ? 'hour' : 'hours'})`;
  }
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

export function originOf(link: string): string | undefined {
  try {
    return new URL(link).origin;
  } catch {
    return undefined;
  }
}
