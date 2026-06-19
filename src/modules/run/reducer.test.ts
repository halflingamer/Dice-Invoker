import { describe, expect, it } from "vitest";
import { seasonOne } from "@/modules/content/season-1";
import { createEventOffer } from "@/modules/game-engine/events";
import { createRewardOffer } from "@/modules/game-engine/rewards";
import { runCommandSchema } from "./command-schema";
import { createRun } from "./create-run";
import { applyCommand } from "./reducer";

function readyToRollRun() {
  const run = createRun({ seed: "server-seed", heroId: "squire" });
  return {
    ...run,
    phase: "ready-to-roll" as const,
    currentRoomId: run.map.layers[0]!.nodes[0]!.id,
    availableRoomIds: [],
  };
}

describe("run reducer", () => {
  it("starts before the first choice with an authoritative rolled map and D4 class", () => {
    const run = createRun({ seed: "server-seed", heroId: "squire" });

    expect(run.phase).toBe("map-reveal");
    expect(run.map.layers).toHaveLength(10);
    expect(run.availableRoomIds).toEqual(run.map.layers[0]!.nodes.map((node) => node.id));
    expect(run.currentRoomId).toBeNull();
    expect(run.visitedRoomIds).toEqual([]);
    expect(run.currentLayer).toBe(0);
    expect(run.currentClassStageId).toBe("squire-d4");
    expect(run.xp).toBe(0);
    expect(run.rngCursors).toEqual({
      map: run.map.rngCursor,
      encounter: 0,
      combat: 0,
      reward: 0,
      event: 0,
    });
  });

  it("rejects reroll before roll and spends essence exactly once", () => {
    const run = readyToRollRun();

    expect(() =>
      applyCommand(run, { type: "REROLL", sequence: 1, dieIds: ["rusty-sword"] }),
    ).toThrow(/phase/i);

    const rolled = applyCommand(run, { type: "ROLL_DICE", sequence: 1 });
    const rerolled = applyCommand(rolled, {
      type: "REROLL",
      sequence: 2,
      dieIds: ["rusty-sword"],
    });

    expect(rerolled.essence).toBe(rolled.essence - 1);
    expect(rerolled.sequence).toBe(2);
  });

  it("rejects replayed sequence numbers", () => {
    const run = readyToRollRun();
    const rolled = applyCommand(run, { type: "ROLL_DICE", sequence: 1 });

    expect(() => applyCommand(rolled, { type: "ROLL_DICE", sequence: 1 })).toThrow(
      /sequence/i,
    );
  });

  it("rejects dice that are not equipped", () => {
    const run = readyToRollRun();
    const rolled = applyCommand(run, { type: "ROLL_DICE", sequence: 1 });

    expect(() =>
      applyCommand(rolled, { type: "REROLL", sequence: 2, dieIds: ["star-arrow"] }),
    ).toThrow(/equipped/i);
  });

  it("rejects unknown payload fields", () => {
    expect(() =>
      runCommandSchema.parse({ type: "ROLL_DICE", sequence: 1, finalScore: 999_999 }),
    ).toThrow();
  });

  it("accepts only rooms exposed by the official state", () => {
    const run = { ...createRun({ seed: "server-seed", heroId: "squire" }), phase: "room-choice" as const, availableRoomIds: ["room-2-1", "room-2-2"] };

    expect(() => applyCommand(run, { type: "CHOOSE_ROOM", sequence: 1, roomId: "room-9-9" })).toThrow(/available/i);
    expect(applyCommand(run, { type: "CHOOSE_ROOM", sequence: 1, roomId: "room-2-2" }).currentRoomId).toBe("room-2-2");
  });

  it("accepts only reward ids present in the official offer", () => {
    const base = createRun({ seed: "server-seed", heroId: "squire" });
    const rewardOffer = createRewardOffer(base.seed, base.rngCursors.reward, seasonOne.dice.map((die) => die.id));
    const run = { ...base, phase: "reward" as const, rewardOffer };

    expect(() => applyCommand(run, { type: "CHOOSE_REWARD", sequence: 1, rewardId: "reward-forged" })).toThrow(/offered/i);
  });

  it("accepts only event option ids present in the official offer", () => {
    const base = createRun({ seed: "server-seed", heroId: "squire" });
    const event = seasonOne.events.find((candidate) => candidate.id === "goblin-insurance")!;
    const eventOffer = createEventOffer(event, base.seed, base.rngCursors.event);
    const run = {
      ...base,
      phase: "event" as const,
      eventOffer,
      rngCursors: { ...base.rngCursors, event: eventOffer.rngCursor },
    };

    expect(() => applyCommand(run, { type: "CHOOSE_EVENT_OPTION", sequence: 1, optionId: "event-forged" })).toThrow(/offered/i);
  });
});
