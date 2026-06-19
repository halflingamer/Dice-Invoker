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

const at = (milliseconds: number) => ({ now: () => milliseconds });

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

  it("acknowledges the map before accepting a first room", () => {
    const run = createRun({ seed: "server-seed", heroId: "squire" });

    expect(() => applyCommand(run, {
      type: "CHOOSE_ROOM",
      sequence: 1,
      roomId: run.availableRoomIds[0],
    })).toThrow(/phase/i);

    const revealed = applyCommand(run, { type: "ACKNOWLEDGE_MAP_REVEAL", sequence: 1 });
    expect(revealed.phase).toBe("room-choice");
  });

  it("derives legal routes from the official graph", () => {
    const run = applyCommand(
      createRun({ seed: "route-seed", heroId: "squire" }),
      { type: "ACKNOWLEDGE_MAP_REVEAL", sequence: 1 },
    );
    const firstRoomId = run.map.layers[0]!.nodes[0]!.id;
    const bossId = run.map.layers.at(-1)!.nodes[0]!.id;

    expect(() => applyCommand(run, { type: "CHOOSE_ROOM", sequence: 2, roomId: bossId })).toThrow(/available|reachable/i);
    const entered = applyCommand(run, { type: "CHOOSE_ROOM", sequence: 2, roomId: firstRoomId });
    expect(entered).toMatchObject({ currentRoomId: firstRoomId, currentLayer: 1 });
    expect(entered.visitedRoomIds).toEqual([firstRoomId]);

    const officialNextIds = run.map.layers[0]!.nodes[0]!.nextNodeIds;
    const choosingNext = { ...entered, phase: "room-choice" as const, availableRoomIds: officialNextIds };
    expect(() => applyCommand(choosingNext, { type: "CHOOSE_ROOM", sequence: 3, roomId: firstRoomId })).toThrow(/available|reachable|visited/i);
    const skippedRoomId = run.map.layers[2]!.nodes[0]!.id;
    expect(() => applyCommand(choosingNext, { type: "CHOOSE_ROOM", sequence: 3, roomId: skippedRoomId })).toThrow(/available|reachable/i);
  });

  it("accepts only server-offered promotions and no forged progression fields", () => {
    const base = createRun({ seed: "promotion-seed", heroId: "squire" });
    const promoting = {
      ...base,
      phase: "promotion" as const,
      xp: 60,
      pendingPromotionIds: ["warrior-d6", "guardian-d6"],
    };

    expect(() => runCommandSchema.parse({
      type: "CHOOSE_PROMOTION",
      sequence: 1,
      classStageId: "warrior-d6",
      xp: 999_999,
    })).toThrow();
    expect(() => applyCommand(base, {
      type: "CHOOSE_PROMOTION",
      sequence: 1,
      classStageId: "warrior-d6",
    })).toThrow(/phase/i);
    expect(() => applyCommand(promoting, {
      type: "CHOOSE_PROMOTION",
      sequence: 1,
      classStageId: "duelist-d8",
    })).toThrow(/promotion/i);

    const promoted = applyCommand(promoting, {
      type: "CHOOSE_PROMOTION",
      sequence: 1,
      classStageId: "guardian-d6",
    });
    expect(promoted).toMatchObject({
      phase: "room-choice",
      currentClassStageId: "guardian-d6",
      xp: 60,
      pendingPromotionIds: [],
    });
  });

  it("runs combat through a server-timed automatic intervention window", () => {
    const run = readyToRollRun();

    expect(() => runCommandSchema.parse({
      type: "BEGIN_COMBAT_TURN",
      sequence: 1,
      damageResult: 999,
    })).toThrow();

    const rolling = applyCommand(run, { type: "BEGIN_COMBAT_TURN", sequence: 1 }, at(1_000));
    expect(rolling.phase).toBe("combat-intervention");
    expect(rolling.combatTurn).toMatchObject({ turn: 1, interventionEndsAt: 3_500 });
    expect(rolling.combatTurn?.damage.kind).toBe("damage");
    expect(rolling.combatTurn?.defense.kind).toBe("defense");

    expect(() => applyCommand(rolling, { type: "RESOLVE_COMBAT_TURN", sequence: 2 }, at(3_499))).toThrow(/intervention/i);

    const rerolled = applyCommand(rolling, {
      type: "REROLL_COMBAT_DIE",
      sequence: 2,
      dieKind: "damage",
    }, at(2_000));
    expect(rerolled.essence).toBe(rolling.essence - 1);
    expect(() => applyCommand(rerolled, {
      type: "REROLL_COMBAT_DIE",
      sequence: 3,
      dieKind: "damage",
    }, at(2_100))).toThrow(/rerolled/i);

    const resolved = applyCommand(rerolled, { type: "RESOLVE_COMBAT_TURN", sequence: 3 }, at(3_500));
    expect(resolved.sequence).toBe(3);
    expect(resolved.combatTurn).toBeNull();
    expect(["ready-to-roll", "room-choice", "promotion", "complete"]).toContain(resolved.phase);
  });

  it("awards experience only after a combat victory", () => {
    const run = { ...readyToRollRun(), enemyHp: 1 };
    const rolling = applyCommand(run, { type: "BEGIN_COMBAT_TURN", sequence: 1 }, at(1_000));
    const resolved = applyCommand(rolling, { type: "RESOLVE_COMBAT_TURN", sequence: 2 }, at(3_500));

    expect(resolved.enemyHp).toBe(0);
    expect(resolved.xp).toBeGreaterThan(0);
    expect(["room-choice", "promotion", "complete"]).toContain(resolved.phase);
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
    const base = createRun({ seed: "server-seed", heroId: "squire" });
    const run = { ...base, phase: "room-choice" as const };

    expect(() => applyCommand(run, { type: "CHOOSE_ROOM", sequence: 1, roomId: "room-9-9" })).toThrow(/available/i);
    expect(applyCommand(run, { type: "CHOOSE_ROOM", sequence: 1, roomId: run.availableRoomIds[1]! }).currentRoomId).toBe(run.availableRoomIds[1]);
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
