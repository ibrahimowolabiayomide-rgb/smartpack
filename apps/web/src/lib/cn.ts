/** Joins class names, skipping falsy values. Small enough that a dependency is not justified. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
