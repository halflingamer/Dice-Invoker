import { describe, expect, it } from "vitest";
import { generateMap } from "@/modules/game-engine/map";
import { seasonOne } from "@/modules/content/season-1";
import { createRun } from "./create-run";

describe("createRun guardian campaign state", () => {
  it("creates the canonical phase-one starter state", () => {
    const state = createRun({ seed: "canonical-run-seed", guardianId: "caretaker-slime" });
    const guardian = seasonOne.guardians[0]!;
    const phase = seasonOne.phases[0]!;

    expect(state).toMatchObject({
      campaignPhaseIndex: 1,
      completedRoomCount: 0,
      outcome: "ongoing",
      guardianId: guardian.id,
      unlockedGuardianIds: [guardian.id],
      guardianHp: guardian.maxHp,
      guardianMaxHp: guardian.maxHp,
      guardianNaturalDefense: guardian.naturalDefense,
      invaderId: "torch-bearer",
      invaderHp: 9,
      invaderMaxHp: 9,
      invaderNaturalDefense: 0,
      inventory: [],
      consumables: {},
      equipment: { "caretaker-slime": { weapon: null, armor: null, accessory: null } },
    });
    expect(state.map).toEqual(generateMap({ seed: state.seed, phaseIndex: 1, roomCount: phase.roomCount }));
    expect(state.heroHp).toBe(state.guardianHp);
    expect(state.heroMaxHp).toBe(state.guardianMaxHp);
    expect(state.enemyHp).toBe(state.invaderHp);
  });

  it("rejects non-starter and unknown guardians", () => {
    expect(() => createRun({ seed: "canonical-run-seed", guardianId: "unknown" })).toThrow("unknown guardian");
  });

  it("rejects legacy hero input at the canonical creation boundary", () => {
    expect(() => createRun({ seed: "canonical-run-seed", heroId: "squire" } as never)).toThrow("unknown guardian");
  });
});
