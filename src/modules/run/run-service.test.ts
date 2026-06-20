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
});
