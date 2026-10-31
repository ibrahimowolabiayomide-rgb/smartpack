import { describe, expect, it } from '@jest/globals';
import { resolveRequestId } from './request-id.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it('keeps a well-formed caller-supplied id', () => {
    expect(resolveRequestId('trace-abc_123.XYZ')).toBe('trace-abc_123.XYZ');
  });

  it('uses the first value when the header repeats', () => {
    expect(resolveRequestId(['first-id-0001', 'second-id-0002'])).toBe('first-id-0001');
  });

  it('generates a UUID when absent', () => {
    expect(resolveRequestId(undefined)).toMatch(UUID);
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'a'.repeat(65)],
    ['whitespace', 'has space 123'],
    ['markup', '<script>alert(1)</script>'],
    ['newline (log injection)', 'valid-prefix\nFAKE LOG LINE'],
    ['empty', ''],
  ])('replaces an id that is %s', (_label, value) => {
    const id = resolveRequestId(value);
    expect(id).toMatch(UUID);
    expect(id).not.toBe(value);
  });
});
