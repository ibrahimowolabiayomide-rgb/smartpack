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
