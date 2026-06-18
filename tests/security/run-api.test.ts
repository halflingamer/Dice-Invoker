import { describe, expect, it, vi } from "vitest";
import { createRunCommandHandler } from "@/modules/run/run-command-handler";

function request(body: unknown, idempotencyKey = "11111111-1111-4111-8111-111111111111") {
  return new Request("http://localhost/api/runs/run-1/commands", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });
}

describe("run command API", () => {
  it("returns 401 without a session", async () => {
    const execute = vi.fn();
    const handler = createRunCommandHandler({
      authenticate: async () => null,
      execute,
      consumeRateLimit: () => true,
    });

    const response = await handler(request({ type: "ROLL_DICE", sequence: 1 }), "run-1");
    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects unknown payload fields", async () => {
    const execute = vi.fn();
    const handler = createRunCommandHandler({
      authenticate: async () => ({ userId: "user-1" }),
      execute,
      consumeRateLimit: () => true,
    });

    const response = await handler(
      request({ type: "ROLL_DICE", sequence: 1, finalScore: 999_999 }),
      "run-1",
    );
    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 429 when the account or run limit is exhausted", async () => {
    const execute = vi.fn();
    const handler = createRunCommandHandler({
      authenticate: async () => ({ userId: "user-1" }),
      execute,
      consumeRateLimit: () => false,
    });

    const response = await handler(request({ type: "ROLL_DICE", sequence: 1 }), "run-1");
    expect(response.status).toBe(429);
    expect(execute).not.toHaveBeenCalled();
  });

  it("passes only validated intent and the idempotency key to the service", async () => {
    const execute = vi.fn().mockResolvedValue({ id: "run-1", version: 1, state: {} });
    const handler = createRunCommandHandler({
      authenticate: async () => ({ userId: "user-1" }),
      execute,
      consumeRateLimit: () => true,
    });

    const response = await handler(request({ type: "ROLL_DICE", sequence: 1 }), "run-1");
    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(
      "user-1",
      "run-1",
      "11111111-1111-4111-8111-111111111111",
      { type: "ROLL_DICE", sequence: 1 },
    );
  });
});
