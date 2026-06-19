import { randomUUID } from "node:crypto";
import { runCommandSchema, type RunCommand } from "./command-schema";
import { parseJsonBody, readIdempotencyKey, RequestValidationError } from "@/modules/security/request";

type SessionIdentity = { userId: string } | null;

type Dependencies = Readonly<{
  authenticate(): Promise<SessionIdentity>;
  execute(userId: string, runId: string, idempotencyKey: string, command: RunCommand): Promise<unknown>;
  consumeRateLimit(userId: string, runId: string): boolean;
}>;

function json(status: number, body: unknown) {
  return Response.json(body, { status });
}

export function createRunCommandHandler(dependencies: Dependencies) {
  return async (request: Request, runId: string): Promise<Response> => {
    const identity = await dependencies.authenticate();
    if (!identity) return json(401, { error: "authentication_required" });
    if (!dependencies.consumeRateLimit(identity.userId, runId)) {
      return json(429, { error: "rate_limit_exceeded" });
    }

    try {
      const idempotencyKey = readIdempotencyKey(request);
      const command = await parseJsonBody(request, runCommandSchema);
      const result = await dependencies.execute(identity.userId, runId, idempotencyKey, command);
      return json(200, result);
    } catch (error) {
      if (error instanceof RequestValidationError) return json(400, { error: error.message });
      const message = error instanceof Error ? error.message : "unknown error";
      if (/not found/i.test(message)) return json(404, { error: "run_not_found" });
      if (/sequence|version conflict|phase|room|promotion/i.test(message)) {
        return json(409, { error: "run_state_conflict" });
      }
      return json(500, { error: "internal_error", correlationId: randomUUID() });
    }
  };
}
