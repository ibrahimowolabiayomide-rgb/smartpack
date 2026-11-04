import { Body, Controller, Post } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { apiErrorSchema } from '@smartpack/shared';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { MAX_DISCARDED_BODY_BYTES } from '../src/common/body-limit.js';
import { Public } from '../src/auth/decorators.js';
import { createTestApp, migrateTestDatabase, testConfig } from './helpers.js';

const echoBody = z.object({ name: z.string().min(1) });

// Reachable without a session on purpose: these tests are about HTTP conventions, not sign-in.
@Public()
@Controller('test-body-limit')
class BodyLimitTestController {
  @Post('echo')
  echo(@Body({ schema: echoBody }) body: z.infer<typeof echoBody>) {
    return { name: body.name };
  }
}

interface UploadResult {
  status: number | undefined;
  body: string;
  connectionHeader: string | undefined;
  bytesWritten: number;
  clientError: string | undefined;
  socketId: number;
}

let socketCounter = 0;
const socketIds = new WeakMap<object, number>();

/**
 * Streams `total` bytes at a fixed pace through one keep-alive agent, so the server's early
 * answer arrives while the client is still uploading. Returns everything the client observed.
 */
function paceUpload(
  agent: http.Agent,
  port: number,
  total: number,
  chunk: number,
  delayMs: number,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    let bytesWritten = 0;
    let clientError: string | undefined;
    let response: Omit<UploadResult, 'bytesWritten' | 'clientError'> | undefined;
    let uploadFinished = false;

    const settle = (): void => {
      if (response === undefined || !uploadFinished) return;
      resolve({ ...response, bytesWritten, clientError });
    };

    const req = http.request(
      {
        agent,
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/api/v1/test-body-limit/echo',
        headers: { 'content-type': 'application/json', 'content-length': total },
      },
      (res) => {
        const socket = res.socket;
        if (!socketIds.has(socket)) socketIds.set(socket, ++socketCounter);
        const parts: Buffer[] = [];
        res.on('data', (part: Buffer) => parts.push(part));
        res.on('end', () => {
          response = {
            status: res.statusCode,
            body: Buffer.concat(parts).toString('utf8'),
            connectionHeader: res.headers.connection,
            socketId: socketIds.get(socket) ?? -1,
          };
          settle();
        });
      },
    );
    req.on('error', (error: NodeJS.ErrnoException) => {
      clientError = error.code ?? error.message;
      // A failed write ends the upload: nothing more can be sent on this connection.
      uploadFinished = true;
      settle();
    });
    const pump = (): void => {
      if (req.destroyed) {
        uploadFinished = true;
        return settle();
      }
      if (bytesWritten >= total) {
        uploadFinished = true;
        req.end();
        return settle();
      }
      const size = Math.min(chunk, total - bytesWritten);
      req.write(Buffer.alloc(size, 0x78));
      bytesWritten += size;
      setTimeout(pump, delayMs);
    };
    pump();
  });
}

describe('oversized request bodies', () => {
  let app: NestFastifyApplication;
  let port: number;

  beforeAll(async () => {
    await migrateTestDatabase();
    app = await createTestApp(testConfig(), [BodyLimitTestController]);
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets a slow client finish its upload and read a complete 413', async () => {
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    try {
      const total = 3_000_000;
      const result = await paceUpload(agent, port, total, 65_536, 3);
      expect(result.clientError).toBeUndefined();
      expect(result.status).toBe(413);
      expect(apiErrorSchema.parse(JSON.parse(result.body)).error.code).toBe('PAYLOAD_TOO_LARGE');
      // Before the fix the server closed the socket after roughly the first chunk; the client
      // was cut off mid-upload, which is the condition that surfaces as ECONNRESET/EPIPE.
      expect(result.bytesWritten).toBe(total);
    } finally {
      agent.destroy();
    }
  });

  it('keeps the connection usable after rejecting a declared-oversize body', async () => {
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    try {
      const first = await paceUpload(agent, port, 1_500_000, 250_000, 1);
      const second = await paceUpload(agent, port, 1_500_000, 250_000, 1);
      expect(first.status).toBe(413);
      expect(first.connectionHeader).not.toBe('close');
      expect(second.status).toBe(413);
      expect(second.socketId).toBe(first.socketId);
    } finally {
      agent.destroy();
    }
  });

  it('refuses to read a huge declared body and closes the connection instead', async () => {
    const agent = new http.Agent({ keepAlive: false });
    try {
      const result = await paceUpload(agent, port, MAX_DISCARDED_BODY_BYTES + 1, 64 * 1024, 1_000);
      expect(result.status).toBe(413);
      expect(result.connectionHeader).toBe('close');
      expect(result.bytesWritten).toBeLessThan(MAX_DISCARDED_BODY_BYTES);
    } finally {
      agent.destroy();
    }
  });

  it('accepts a body just under the limit', async () => {
    const agent = new http.Agent({ keepAlive: false });
    try {
      const payload = JSON.stringify({ name: 'x'.repeat(1_000_000) });
      const result = await new Promise<number | undefined>((resolve, reject) => {
        const req = http.request(
          {
            agent,
            host: '127.0.0.1',
            port,
            method: 'POST',
            path: '/api/v1/test-body-limit/echo',
            headers: {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode));
          },
        );
        req.on('error', reject);
        req.end(payload);
      });
      expect(result).toBe(201);
    } finally {
      agent.destroy();
    }
  });
});
