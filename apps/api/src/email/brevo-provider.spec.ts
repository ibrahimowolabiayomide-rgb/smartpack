import { describe, expect, it, jest } from '@jest/globals';
import { describeFailure } from './email.service.js';
import { BrevoDeliveryError, BrevoEmailProvider } from './providers.js';

const API_KEY = 'xkeysib-0123456789abcdef0123456789abcdef-TestKeyOnly';
const MESSAGE = {
  to: 'worker@example.test',
  subject: 'Reset your password',
  text: 'plain body',
  html: '<p>html body</p>',
};

type Fetch = ConstructorParameters<typeof BrevoEmailProvider>[1];

function provider(fetchImpl: Fetch) {
  return new BrevoEmailProvider(
    {
      apiKey: API_KEY,
      baseUrl: 'https://api.brevo.test',
      sender: { name: 'SmartPack', email: 'sender@example.test' },
    },
    fetchImpl,
  );
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function failureOf(fetchImpl: Fetch): Promise<BrevoDeliveryError> {
  try {
    await provider(fetchImpl).send(MESSAGE);
  } catch (error) {
    expect(error).toBeInstanceOf(BrevoDeliveryError);
    return error as BrevoDeliveryError;
  }
  throw new Error('expected send to reject');
}

describe('BrevoEmailProvider', () => {
  it('posts the message to the transactional endpoint with the configured sender', async () => {
    const fetchImpl = jest.fn<NonNullable<Fetch>>(() =>
      Promise.resolve(json(201, { messageId: '<abc@smtp-relay.mailin.fr>' })),
    );
    const result = await provider(fetchImpl).send(MESSAGE);

    expect(result).toEqual({ providerMessageId: '<abc@smtp-relay.mailin.fr>' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.test/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['api-key']).toBe(API_KEY);
    expect(init.redirect).toBe('error');
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: 'SmartPack', email: 'sender@example.test' },
      to: [{ email: 'worker@example.test' }],
      subject: 'Reset your password',
      htmlContent: '<p>html body</p>',
      textContent: 'plain body',
    });
  });

  it('treats any 2xx answer as accepted even without a message id', async () => {
    const result = await provider(() => Promise.resolve(json(202, {}))).send(MESSAGE);
    expect(result.providerMessageId).toBeUndefined();
  });

  it.each([
    [401, 'check BREVO_API_KEY'],
    [403, 'authorised'],
    [429, 'rate limiting'],
  ])('rejects HTTP %i with an actionable reason', async (status, hint) => {
    const error = await failureOf(() =>
      Promise.resolve(json(status, { code: 'x', message: 'Provider detail' })),
    );
    expect(error.status).toBe(status);
    expect(error.message).toContain(`HTTP ${status}`);
    expect(error.message).toContain(hint);
    expect(error.message).toContain('Provider detail');
  });

  it('passes Brevo’s explanation of a refused sender through', async () => {
    const error = await failureOf(() =>
      Promise.resolve(json(400, { code: 'invalid_parameter', message: 'Sender is not valid' })),
    );
    expect(error.status).toBe(400);
    expect(error.message).toContain('Sender is not valid');
  });

  it('survives a non-JSON error page', async () => {
    const error = await failureOf(() =>
      Promise.resolve(new Response('<html>Bad gateway</html>', { status: 502 })),
    );
    expect(error.status).toBe(502);
    expect(error.message).toBe('Brevo refused the message (HTTP 502).');
  });

  it('reports an unreachable Brevo without leaking connection details', async () => {
    const error = await failureOf(() =>
      Promise.reject(new TypeError(`fetch failed for api-key ${API_KEY}`)),
    );
    expect(error.status).toBeNull();
    expect(error.message).toBe('Brevo could not be reached.');
  });

  it('reports a timeout distinctly', async () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    const error = await failureOf(() => Promise.reject(timeout));
    expect(error.message).toBe('Brevo did not answer in time.');
  });

  it('never lets the API key out, even if Brevo echoes it back', async () => {
    const error = await failureOf(() =>
      Promise.resolve(json(401, { message: `Key ${API_KEY} is not valid` })),
    );
    expect(error.message).not.toContain(API_KEY);
    expect(error.message).toContain('[redacted]');
  });
});

describe('describeFailure', () => {
  it('redacts Brevo keys and key-looking assignments', () => {
    expect(describeFailure(new Error(`bad ${API_KEY} here`))).toBe('bad [redacted] here');
    expect(describeFailure(new Error('api-key: abc123 rejected'))).not.toContain('abc123');
  });

  it('keeps only the first line and a bounded length', () => {
    expect(describeFailure(new Error('first\nsecond'))).toBe('first');
    expect(describeFailure(new Error('x'.repeat(1000))).length).toBe(300);
  });
});
