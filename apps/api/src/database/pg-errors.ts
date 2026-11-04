interface PgErrorShape {
  code?: unknown;
  constraint?: unknown;
  cause?: unknown;
}

/** Finds the driver error (code, constraint) under Drizzle's "Failed query" wrapper. */
export function pgErrorOf(error: unknown): { code?: string; constraint?: string } {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as PgErrorShape;
    if (typeof candidate.code === 'string') {
      return {
        code: candidate.code,
        constraint: typeof candidate.constraint === 'string' ? candidate.constraint : undefined,
      };
    }
    current = candidate.cause;
  }
  return {};
}

export const PG_UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const found = pgErrorOf(error);
  return (
    found.code === PG_UNIQUE_VIOLATION &&
    (constraint === undefined || found.constraint === constraint)
  );
}
