import { describe, expect, it } from '@jest/globals';
import { summariseDatabaseError } from './error-summary.js';

describe('summariseDatabaseError', () => {
  it('reports the root cause rather than the wrapper', () => {
    const driver = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });
    const wrapper = new Error('Failed query: select 1\nparams: ', { cause: driver });
    expect(summariseDatabaseError(wrapper)).toBe(
      'ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:5432',
    );
  });

  it('follows a chain of causes', () => {
    const root = Object.assign(new Error('password authentication failed'), { code: '28P01' });
    const middle = new Error('middle', { cause: root });
    const top = new Error('top', { cause: middle });
    expect(summariseDatabaseError(top)).toBe('28P01: password authentication failed');
  });

  it('uses only the first line of a multi-line message', () => {
    const error = new Error('first line\nselect * from secrets\nsecond line');
    expect(summariseDatabaseError(error)).toBe('first line');
  });

  it('falls back to the error name when there is no message or code', () => {
    const aggregate = new AggregateError([], '');
    expect(summariseDatabaseError(aggregate)).toBe('AggregateError');
  });

  it('copes with values that are not errors', () => {
    expect(summariseDatabaseError('boom')).toBe('unknown error');
    expect(summariseDatabaseError(undefined)).toBe('unknown error');
  });

  it('survives a circular cause chain', () => {
    const a = new Error('a');
    const b = new Error('b', { cause: a });
    (a as { cause?: unknown }).cause = b;
    expect(() => summariseDatabaseError(a)).not.toThrow();
  });
});
