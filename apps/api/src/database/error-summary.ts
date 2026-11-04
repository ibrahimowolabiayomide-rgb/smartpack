const MAX_CAUSE_DEPTH = 5;

function rootCause(error: Error): Error {
  let current = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (!(current.cause instanceof Error)) break;
    current = current.cause;
  }
  return current;
}

/**
 * One-line description of a database failure, safe for logs.
 *
 * Drizzle wraps driver errors in "Failed query: <sql>" and keeps the real reason (for example
 * ECONNREFUSED) in `cause`, so the root cause is reported. Only the error code and message are
 * used. The full error object is never logged because driver errors can embed connection details.
 */
export function summariseDatabaseError(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  const cause = rootCause(error);
  const code = (cause as { code?: unknown }).code;
  const parts = [
    typeof code === 'string' ? code : undefined,
    // Multi-line messages (query text, parameters) are reduced to their first line.
    cause.message.split('\n')[0]?.trim() || undefined,
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(': ') : cause.name;
}

/**
 * Error codes that mean the database could not be reached or refused the connection, as opposed to
 * a problem with a particular query. Node socket codes, then PostgreSQL SQLSTATE classes: 08 is a
 * connection exception, 57P01..57P03 are shutdown or "cannot connect now", 53300 is "too many
 * connections".
 */
const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  '57P01',
  '57P02',
  '57P03',
  '53300',
]);

const UNAVAILABLE_MESSAGES = [
  /timeout exceeded when trying to connect/i,
  /connection terminated/i,
  /connection (?:is )?closed/i,
  /server closed the connection/i,
  /cannot use a pool after calling end/i,
];

/**
 * True when the failure is the database being unreachable (so the right answer to the caller is
 * "temporarily unavailable, try again"), not a bug in a query. Looks through Drizzle's wrapper to
 * the driver's own error.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = rootCause(error);
  const code = (cause as { code?: unknown }).code;
  if (typeof code === 'string' && (UNAVAILABLE_CODES.has(code) || code.startsWith('08'))) {
    return true;
  }
  // AggregateError (for example one ECONNREFUSED per resolved address) carries its own list.
  const inner = (cause as { errors?: unknown }).errors;
  if (Array.isArray(inner) && inner.length > 0 && inner.every(isDatabaseUnavailable)) return true;
  return UNAVAILABLE_MESSAGES.some((pattern) => pattern.test(cause.message));
}
