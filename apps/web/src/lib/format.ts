/**
 * Formats an ISO timestamp for display in a company's time zone. The locale is fixed so the server
 * render and the browser agree (a mismatch would break hydration). An unknown zone falls back to UTC
 * and says so, rather than showing a wrong local time.
 */
export function formatTimestamp(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(date);
  } catch {
    return `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date)} UTC`;
  }
}

export function formatDate(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  try {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
  }
}
