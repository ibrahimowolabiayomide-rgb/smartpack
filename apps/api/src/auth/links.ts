/**
 * Links in emails carry the one-time token in the URL FRAGMENT (after #). Browsers never send the
 * fragment to a server, so the token stays out of web-server logs, proxy logs and Referer headers;
 * the page reads it with JavaScript and posts it to the API.
 */
export const invitationLink = (webAppUrl: string, token: string) =>
  `${webAppUrl}/accept-invitation#token=${token}`;
export const passwordResetLink = (webAppUrl: string, token: string) =>
  `${webAppUrl}/reset-password#token=${token}`;
export const emailVerificationLink = (webAppUrl: string, token: string) =>
  `${webAppUrl}/verify-email#token=${token}`;
