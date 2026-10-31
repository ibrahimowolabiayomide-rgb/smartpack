import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Derives an OpenAPI 3.0 schema from a Zod schema so the published documentation and the
 * runtime contract cannot drift apart.
 */
export function toOpenApiSchema(schema: z.ZodType): SchemaObject {
  // Zod emits a JSON Schema object; for target "openapi-3.0" it is structurally an
  // OpenAPI 3.0 schema object. The cast is confined to this one function.
  return z.toJSONSchema(schema, { target: 'openapi-3.0' }) as unknown as SchemaObject;
}
