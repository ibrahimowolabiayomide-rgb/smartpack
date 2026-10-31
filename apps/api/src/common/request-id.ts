import { randomUUID } from 'node:crypto';

/** Conservative on purpose: the id is echoed in a response header and written to logs. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Accepts a caller-supplied `x-request-id` only if it is a short, plain token; otherwise a
 * new UUID is generated. Accepting arbitrary values would let a client inject newlines or
 * oversized strings into log output.
 */
export function resolveRequestId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header;
  if (candidate !== undefined && REQUEST_ID_PATTERN.test(candidate)) return candidate;
  return randomUUID();
}

export const REQUEST_ID_HEADER = 'x-request-id';
