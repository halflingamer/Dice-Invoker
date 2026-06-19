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

  it("rate limits the validated command class", async () => {
    const consumeRateLimit = vi.fn(() => true);
    const handler = createRunCommandHandler({
      authenticate: async () => ({ userId: "user-1" }),
      execute: vi.fn().mockResolvedValue({ id: "run-1", version: 1, state: {} }),
      consumeRateLimit,
    });

    await handler(request({ type: "BEGIN_COMBAT_TURN", sequence: 1 }), "run-1");

    expect(consumeRateLimit).toHaveBeenCalledWith("user-1", "run-1", "BEGIN_COMBAT_TURN");
  });

  it("returns a redacted conflict for expired combat windows", async () => {
    const handler = createRunCommandHandler({
      authenticate: async () => ({ userId: "user-1" }),
      execute: vi.fn().mockRejectedValue(new Error("combat intervention window has ended at secret-time")),
      consumeRateLimit: () => true,
    });

    const response = await handler(request({ type: "REROLL_COMBAT_DIE", sequence: 1, dieKind: "damage" }), "run-1");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "run_state_conflict" });
  });
});
