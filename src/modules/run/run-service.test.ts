import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createSeedCipher } from "@/modules/security/seed-cipher";
import { createMerchantOffer } from "@/modules/game-engine/rewards";
import { RUN_ITEMS } from "@/modules/game-engine/economy";
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
});
