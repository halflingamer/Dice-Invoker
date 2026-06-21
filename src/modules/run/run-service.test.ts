import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createSeedCipher } from "@/modules/security/seed-cipher";
import { createEventOffer } from "@/modules/game-engine/events";
import { createMerchantOffer, createTreasureOffer } from "@/modules/game-engine/rewards";
import { RUN_ITEMS } from "@/modules/game-engine/economy";
import { seasonOne } from "@/modules/content/season-1";
import { createRun } from "./create-run";
import { createRunService } from "./run-service";
import type { RunState } from "./state";

const secret = Buffer.alloc(32, 7);
type MutableRunState = { -readonly [Key in keyof RunState]?: RunState[Key] };

function persisted(state: RunState) {
  const publicState: MutableRunState = { ...state };
  delete publicState.seed;
  return publicState as Omit<RunState, "seed">;
}

function serviceHarness(state: RunState, version = 4) {
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const create = vi.fn(async () => ({}));
  const findUnique = vi.fn(async () => null);
  const prisma = {
    runCommand: { findUnique },
    run: {
      findFirst: vi.fn(async () => ({
        id: "run-1",
        ownerId: "user-1",
        version,
        seedCiphertext: createSeedCipher(secret).encrypt(state.seed),
        stateJson: persisted(state),
      })),
    },
    $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<void>) => callback({
      run: { updateMany },
      runCommand: { create },
    })),
  };
  return {
    service: createRunService({ prisma: prisma as unknown as PrismaClient, seedSecret: secret }),
    updateMany,
    create,
  };
}

describe("run service interactive commands", () => {
  it.each([
    ["phase", { campaignPhaseIndex: 0 }],
    ["outcome", { outcome: "victory", phase: "map-reveal" }],
    ["slots", { equipment: { "caretaker-slime": { weapon: null, armor: null, accessory: null, ring: null } } }],
    ["item", { inventory: ["forged-item"] }],
    ["equipment ownership", { equipment: { "caretaker-slime": { weapon: "sharp-sword", armor: null, accessory: null } } }],
    ["equipment type", { inventory: ["sharp-sword"], equipment: { "caretaker-slime": { weapon: null, armor: "sharp-sword", accessory: null } } }],
    ["consumable count", { consumables: { "healing-potion": Number.MAX_SAFE_INTEGER + 1 } }],
  ])("rejects invalid persisted canonical %s", async (_label, mutation) => {
    const base = createRun({ seed: "invalid-canonical-secret", guardianId: "caretaker-slime" });
    const { service } = serviceHarness({ ...base, ...mutation } as unknown as RunState);
    const execution = service.execute("user-1", "run-1", "invalid-canonical-key", {
      type: "ACKNOWLEDGE_MAP_REVEAL", sequence: 1,
    });
    await expect(execution).rejects.toThrow("stored run state is invalid");
    await expect(execution).rejects.not.toThrow(/invalid-canonical-secret/);
  });

  it("rejects forged partial canonical state instead of applying legacy defaults", async () => {
    const base = createRun({ seed: "partial-canonical-secret", guardianId: "caretaker-slime" });
    const legacy = persisted(base) as Record<string, unknown>;
    for (const key of ["campaignPhaseIndex", "completedRoomCount", "outcome", "unlockedGuardianIds", "guardianHp", "guardianMaxHp", "guardianNaturalDefense", "invaderId", "invaderHp", "invaderMaxHp", "invaderNaturalDefense", "consumables", "equipment"]) delete legacy[key];
    const { service } = serviceHarness({ ...legacy, seed: base.seed, guardianId: "caretaker-slime" } as unknown as RunState);
    await expect(service.execute("user-1", "run-1", "partial-key", {
      type: "ACKNOWLEDGE_MAP_REVEAL", sequence: 1,
    })).rejects.toThrow("stored run state is invalid");
  });

  it("safely migrates an unambiguous legacy starter state", async () => {
    const base = createRun({ seed: "safe-legacy-seed", guardianId: "caretaker-slime" });
    const legacy = persisted(base) as Record<string, unknown>;
    for (const key of ["campaignPhaseIndex", "completedRoomCount", "outcome", "guardianId", "unlockedGuardianIds", "guardianHp", "guardianMaxHp", "guardianNaturalDefense", "invaderId", "invaderHp", "invaderMaxHp", "invaderNaturalDefense", "consumables", "equipment"]) delete legacy[key];
    legacy.heroHp = 24;
    legacy.heroMaxHp = 24;
    const { service } = serviceHarness({ ...legacy, seed: base.seed } as unknown as RunState);
    const response = await service.execute("user-1", "run-1", "legacy-migrate-key", {
      type: "ACKNOWLEDGE_MAP_REVEAL", sequence: 1,
    });
    expect(response.state).toMatchObject({ guardianId: "caretaker-slime", campaignPhaseIndex: 1, outcome: "ongoing" });
  });
  it("persists the reducer-assigned sequence for commands without sequence", async () => {
    const base = createRun({ seed: "service-merchant", heroId: "squire" });
    const state = {
      ...base,
      currentRoomId: base.map.layers[0]!.nodes[0]!.id,
      pendingRoom: { kind: "merchant" as const, offer: createMerchantOffer(base.seed, 0, Object.keys(RUN_ITEMS)) },
    };
    const { service, create } = serviceHarness(state);

    const response = await service.execute("user-1", "run-1", "http-key-1", {
      type: "LEAVE_MERCHANT",
      commandId: "leave-service",
    });

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ sequence: state.sequence + 1 }) });
    expect(response.version).toBe(5);
    expect(response.state).not.toHaveProperty("seed");
  });

  it("returns a commandId replay without writes or version bump", async () => {
    const base = createRun({ seed: "service-replay", heroId: "squire" });
    const state = { ...base, sequence: 3, handledRoomCommandIds: ["leave-replayed"] };
    const { service, updateMany, create } = serviceHarness(state, 8);

    const response = await service.execute("user-1", "run-1", "different-http-key", {
      type: "LEAVE_MERCHANT",
      commandId: "leave-replayed",
    });

    expect(response.version).toBe(8);
    expect(response.state).not.toHaveProperty("seed");
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("recovers a concurrent commandId replay after losing the version race", async () => {
    const base = createRun({ seed: "service-race", heroId: "squire" });
    const initial = {
      ...base,
      currentRoomId: base.map.layers[0]!.nodes[0]!.id,
      pendingRoom: { kind: "merchant" as const, offer: createMerchantOffer(base.seed, 0, Object.keys(RUN_ITEMS)) },
    };
    const winner = {
      ...initial,
      sequence: initial.sequence + 1,
      pendingRoom: null,
      handledRoomCommandIds: ["leave-race"],
    };
    const findFirst = vi.fn()
      .mockResolvedValueOnce({
        id: "run-1", ownerId: "user-1", version: 4,
        seedCiphertext: createSeedCipher(secret).encrypt(base.seed), stateJson: persisted(initial),
      })
      .mockResolvedValueOnce({
        id: "run-1", ownerId: "user-1", version: 5,
        seedCiphertext: createSeedCipher(secret).encrypt(base.seed), stateJson: persisted(winner),
      });
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const create = vi.fn(async () => ({}));
    const prisma = {
      runCommand: { findUnique: vi.fn(async () => null) },
      run: { findFirst },
      $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<void>) => callback({
        run: { updateMany }, runCommand: { create },
      })),
    };
    const service = createRunService({ prisma: prisma as unknown as PrismaClient, seedSecret: secret });

    const response = await service.execute("user-1", "run-1", "loser-http-key", {
      type: "LEAVE_MERCHANT", commandId: "leave-race",
    });

    expect(response.version).toBe(5);
    expect(response.state).not.toHaveProperty("seed");
    expect(response.state.handledRoomCommandIds).toContain("leave-race");
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it("normalizes legacy room fields before entering an interactive room", async () => {
    const base = createRun({ seed: "service-legacy", heroId: "squire" });
    const firstRoom = base.map.layers[0]!.nodes[0]!;
    const current = {
      ...base,
      phase: "room-choice" as const,
      map: {
        ...base.map,
        layers: base.map.layers.map((layer) => ({
          ...layer,
          nodes: layer.nodes.map((node) => node.id === firstRoom.id ? { ...node, type: "merchant" as const } : node),
        })),
      },
      availableRoomIds: [firstRoom.id],
    };
    const legacy: MutableRunState = persisted(current);
    delete legacy.inventory;
    delete legacy.pendingRoom;
    delete legacy.handledRoomCommandIds;
    delete legacy.purchasedMerchantOfferIds;
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prisma = {
      runCommand: { findUnique: vi.fn(async () => null) },
      run: { findFirst: vi.fn(async () => ({
        id: "run-1", ownerId: "user-1", version: 2,
        seedCiphertext: createSeedCipher(secret).encrypt(base.seed), stateJson: legacy,
      })) },
      $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<void>) => callback({
        run: { updateMany }, runCommand: { create: vi.fn(async () => ({})) },
      })),
    };
    const service = createRunService({ prisma: prisma as unknown as PrismaClient, seedSecret: secret });

    const response = await service.execute("user-1", "run-1", "legacy-http-key", {
      type: "CHOOSE_ROOM", sequence: 1, roomId: firstRoom.id,
    });

    expect(response.state.inventory).toEqual([]);
    expect(response.state.handledRoomCommandIds).toEqual([]);
    expect(response.state.purchasedMerchantOfferIds).toEqual([]);
    expect(response.state.pendingRoom?.kind).toBe("merchant");
    expect(response.state).not.toHaveProperty("seed");
  });

  it("rejects a forged persisted inventory item without exposing the seed", async () => {
    const base = createRun({ seed: "private-inventory-seed", heroId: "squire" });
    const forged = { ...base, inventory: ["forged-item"] } as unknown as RunState;
    const { service } = serviceHarness(forged);

    const execution = service.execute("user-1", "run-1", "forged-inventory-key", {
      type: "ACKNOWLEDGE_MAP_REVEAL", sequence: 1,
    });

    await expect(execution).rejects.toThrow("stored run state is invalid");
    await expect(execution).rejects.not.toThrow(/private-inventory-seed/);
  });

  it("rejects malformed persisted room command ids", async () => {
    const base = createRun({ seed: "invalid-command-id-seed", heroId: "squire" });
    const malformed = {
      ...base,
      handledRoomCommandIds: ["UPPERCASE"],
      purchasedMerchantOfferIds: ["x".repeat(81)],
    } as unknown as RunState;
    const { service } = serviceHarness(malformed);

    await expect(service.execute("user-1", "run-1", "invalid-id-key", {
      type: "ACKNOWLEDGE_MAP_REVEAL", sequence: 1,
    })).rejects.toThrow("stored run state is invalid");
  });

  it("rejects a persisted merchant pending room without a valid offer", async () => {
    const base = createRun({ seed: "invalid-pending-seed", heroId: "squire" });
    const malformed = { ...base, pendingRoom: { kind: "merchant" } } as unknown as RunState;
    const { service } = serviceHarness(malformed);

    await expect(service.execute("user-1", "run-1", "invalid-pending-key", {
      type: "ACKNOWLEDGE_MAP_REVEAL", sequence: 1,
    })).rejects.toThrow("stored run state is invalid");
  });

  it("rejects a treasure offer without one option of each reward kind", async () => {
    const base = createRun({ seed: "invalid-treasure-seed", heroId: "squire" });
    const offer = createTreasureOffer(base.seed, 0, Object.keys(RUN_ITEMS));
    const goldPayload = offer.options[0].payload;
    const malformed = {
      ...base,
      pendingRoom: {
        kind: "treasure",
        offer: { ...offer, options: offer.options.map((option) => ({ ...option, payload: goldPayload })) },
      },
    } as unknown as RunState;
    const { service } = serviceHarness(malformed);

    await expect(service.execute("user-1", "run-1", "invalid-treasure-key", {
      type: "ACKNOWLEDGE_MAP_REVEAL", sequence: 1,
    })).rejects.toThrow("stored run state is invalid");
  });

  it("rejects an event result for an option that was not offered", async () => {
    const base = createRun({ seed: "invalid-event-seed", heroId: "squire" });
    const event = seasonOne.events.find((candidate) => candidate.id === "goblin-insurance")!;
    const offer = createEventOffer(event, base.seed, 0);
    const malformed = {
      ...base,
      pendingRoom: {
        kind: "event",
        offer,
        result: {
          gold: base.gold,
          hasInsurance: false,
          hpDelta: 0,
          rngCursor: offer.rngCursor,
          audit: { eventId: offer.eventId, optionId: "not-offered", outcome: "ignored" },
        },
      },
    } as unknown as RunState;
    const { service } = serviceHarness(malformed);

    await expect(service.execute("user-1", "run-1", "invalid-event-key", {
      type: "ACKNOWLEDGE_MAP_REVEAL", sequence: 1,
    })).rejects.toThrow("stored run state is invalid");
  });
});
