/**
 * Test-environment shim, used only by jest.integration.config.mjs.
 *
 * @fastify/static (needed by Swagger UI) requires `content-disposition`, which is ESM-only since
 * v3. Node >= 22.12 can require() ES modules, so the real server is unaffected, but Jest's own
 * module system cannot until Node 24.9. This file loads the *real* package through Node's native
 * loader, resolved from @fastify/static's location (pnpm does not hoist it), so tests exercise
 * the genuine library. Remove this shim and its moduleNameMapper entry once Jest runs on Node >= 24.9.
 */
const { createRequire } = require('node:module');

const fromTests = createRequire(__filename);
const fromFastifyStatic = createRequire(fromTests.resolve('@fastify/static'));

module.exports = fromFastifyStatic('content-disposition');
