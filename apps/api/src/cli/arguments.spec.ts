import { describe, expect, it } from '@jest/globals';
import { argumentsToParse } from './arguments.js';

describe('argumentsToParse', () => {
  it('leaves ordinary arguments alone', () => {
    expect(argumentsToParse(['--owner-email', 'a@b.example'])).toEqual([
      '--owner-email',
      'a@b.example',
    ]);
  });

  it('drops one leading double dash added by the package manager', () => {
    expect(argumentsToParse(['--', '--owner-email', 'a@b.example'])).toEqual([
      '--owner-email',
      'a@b.example',
    ]);
  });

  it('keeps a double dash that is not first', () => {
    expect(argumentsToParse(['--owner-email', 'a@b.example', '--'])).toEqual([
      '--owner-email',
      'a@b.example',
      '--',
    ]);
  });

  it('handles no arguments', () => {
    expect(argumentsToParse([])).toEqual([]);
  });
});
