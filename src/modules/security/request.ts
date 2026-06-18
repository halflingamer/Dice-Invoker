import { z, type ZodType } from "zod";

const idempotencyKeySchema = z.string().uuid();

export class RequestValidationError extends Error {}

export function readIdempotencyKey(request: Request): string {
  const parsed = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
  if (!parsed.success) throw new RequestValidationError("invalid idempotency key");
  return parsed.data;
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new RequestValidationError("content-type must be application/json");
  }
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 16 * 1024) {
    throw new RequestValidationError("request body is too large");
  }
  try {
    return schema.parse(JSON.parse(body));
  } catch {
    throw new RequestValidationError("invalid request body");
  }
}
