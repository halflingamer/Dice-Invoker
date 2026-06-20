import { expect, it, vi } from "vitest";
import { createRunCommandHandler } from "./run-command-handler";

const idempotencyKey = "550e8400-e29b-41d4-a716-446655440000";

function request(body: unknown) {
  return new Request("https://dice-invoker.test/api/runs/run-1/commands", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

it.each([
  { type: "BUY_MERCHANT_ITEM", offerId: "merchant-1", commandId: "command-1", price: 0 },
  { type: "CHOOSE_TREASURE", offerId: "treasure-1", commandId: "command-2", reward: { gold: 999 } },
  { type: "CHOOSE_EVENT_OPTION", offerId: "event-1", commandId: "command-3", damage: 0 },
])("rejects client-controlled room values from $type", async (body) => {
  const execute = vi.fn();
  const handler = createRunCommandHandler({
    authenticate: async () => ({ userId: "user-1" }),
    execute,
    consumeRateLimit: () => true,
  });

  const response = await handler(request(body), "run-1");

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid request body" });
  expect(execute).not.toHaveBeenCalled();
});

it("does not leak the run seed or private offer details through errors", async () => {
  const handler = createRunCommandHandler({
    authenticate: async () => ({ userId: "user-1" }),
    execute: async () => {
      throw new Error("seed=private-seed offer=merchant-secret");
    },
    consumeRateLimit: () => true,
  });

  const response = await handler(request({
    type: "LEAVE_MERCHANT",
    commandId: "command-4",
  }), "run-1");
  const serialized = JSON.stringify(await response.json());

  expect(response.status).toBe(500);
  expect(serialized).not.toMatch(/private-seed|merchant-secret|offer/i);
  expect(serialized).toMatch(/internal_error/);
});
