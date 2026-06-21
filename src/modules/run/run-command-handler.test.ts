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

it.each([
  { type: "EQUIP_ITEM", sequence: 1, commandId: "equip-1", guardianId: "caretaker-slime", itemId: "sharp-sword", slot: "weapon" },
  { type: "EQUIP_ITEM", sequence: 1, commandId: "equip-2", guardianId: "caretaker-slime", itemId: "sharp-sword", attack: 999 },
  { type: "UNEQUIP_ITEM", sequence: 1, commandId: "unequip-1", guardianId: "caretaker-slime", slot: "weapon", defense: 999 },
  { type: "USE_CONSUMABLE", sequence: 1, commandId: "use-1", guardianId: "caretaker-slime", itemId: "healing-potion", critical: true },
  { type: "REROLL_COMBAT_DIE", sequence: 1, dieKind: "defense" },
])("rejects forged inventory command fields", async (body) => {
  const execute = vi.fn();
  const handler = createRunCommandHandler({ authenticate: async () => ({ userId: "user-1" }), execute, consumeRateLimit: () => true });
  expect((await handler(request(body), "run-1")).status).toBe(400);
  expect(execute).not.toHaveBeenCalled();
});

it.each([
  { type: "EQUIP_ITEM", sequence: 1, commandId: "equip-ok", guardianId: "caretaker-slime", itemId: "sharp-sword" },
  { type: "UNEQUIP_ITEM", sequence: 1, commandId: "unequip-ok", guardianId: "caretaker-slime", slot: "armor" },
  { type: "USE_CONSUMABLE", sequence: 1, commandId: "use-ok", guardianId: "caretaker-slime", itemId: "healing-potion" },
  { type: "START_NEW_RUN", sequence: 1, commandId: "new-run-ok" },
])("accepts strict canonical command $type", async (body) => {
  const execute = vi.fn().mockResolvedValue({});
  const handler = createRunCommandHandler({ authenticate: async () => ({ userId: "user-1" }), execute, consumeRateLimit: () => true });
  expect((await handler(request(body), "run-1")).status).toBe(200);
  expect(execute).toHaveBeenCalledWith("user-1", "run-1", idempotencyKey, body);
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
