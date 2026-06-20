import { describe, expect, it } from "vitest";
import { seasonOne } from "@/modules/content/season-1";
import { createEventOffer } from "@/modules/game-engine/events";
import { RUN_ITEMS } from "@/modules/game-engine/economy";
import { createMerchantOffer, createRewardOffer, createTreasureOffer } from "@/modules/game-engine/rewards";
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

function enterInteractiveRoom(type: "merchant" | "treasure" | "event") {
  const base = createRun({ seed: `interactive-${type}`, heroId: "squire" });
  const room = base.map.layers[0]!.nodes[0]!;
  const map = {
    ...base.map,
    layers: base.map.layers.map((layer) => ({
      ...layer,
      nodes: layer.nodes.map((node) => node.id === room.id ? { ...node, type } : node),
    })),
  };
  return applyCommand(
    { ...base, map, phase: "room-choice", availableRoomIds: [room.id] },
    { type: "CHOOSE_ROOM", sequence: 1, roomId: room.id },
  );
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
    expect(run).toMatchObject({ heroHp: 24, heroMaxHp: 24, gold: 12, essence: 2 });
    expect(run.inventory).toEqual([]);
    expect(run.pendingRoom).toBeNull();
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

  it.each([
    ["combat", 4],
    ["elite", 6],
    ["boss", 8],
  ] as const)("rolls a D%s enemy attack from the current room rank", (roomType, sides) => {
    const base = readyToRollRun();
    const map = {
      ...base.map,
      layers: base.map.layers.map((layer) => ({
        ...layer,
        nodes: layer.nodes.map((node) => node.id === base.currentRoomId ? { ...node, type: roomType } : node),
      })),
    };

    const rolling = applyCommand({ ...base, map }, { type: "BEGIN_COMBAT_TURN", sequence: 1 }, at(1_000));

    expect(rolling.combatTurn?.enemyAttack.sides).toBe(sides);
    expect(rolling.combatTurn?.enemyAttack.result).toBeGreaterThanOrEqual(1);
    expect(rolling.combatTurn?.enemyAttack.result).toBeLessThanOrEqual(sides);
  });

  it("applies inventory bonuses and defense mitigation while persisting hero HP", () => {
    const run = {
      ...readyToRollRun(),
      heroHp: 20,
      enemyHp: 20,
      inventory: ["sharp-sword", "reinforced-shield"] as const,
      phase: "combat-intervention" as const,
      combatTurn: {
        turn: 1,
        damage: { kind: "damage" as const, sides: 4 as const, faceIndex: 3, label: "Golpe", value: 3, healing: 0 },
        defense: { kind: "defense" as const, sides: 4 as const, faceIndex: 2, label: "Aparar", value: 2, healing: 0 },
        enemyAttack: { sides: 4 as const, result: 4 },
        interventionEndsAt: 3_500,
        rerolledDieKinds: [],
      },
    };

    const resolved = applyCommand(run, { type: "RESOLVE_COMBAT_TURN", sequence: 1 }, at(3_500));

    expect(resolved.enemyHp).toBe(16);
    expect(resolved.heroHp).toBe(19);
  });

  it("prevents the enemy counterattack on victory and awards rank gold once", () => {
    const base = readyToRollRun();
    const run = {
      ...base,
      map: {
        ...base.map,
        layers: base.map.layers.map((layer) => ({
          ...layer,
          nodes: layer.nodes.map((node) => node.id === base.currentRoomId ? { ...node, type: "elite" as const } : node),
        })),
      },
      heroHp: 7,
      enemyHp: 3,
      gold: 0,
      inventory: ["tax-amulet"] as const,
      phase: "combat-intervention" as const,
      combatTurn: {
        turn: 1,
        damage: { kind: "damage" as const, sides: 4 as const, faceIndex: 3, label: "Golpe", value: 3, healing: 0 },
        defense: { kind: "defense" as const, sides: 4 as const, faceIndex: 1, label: "Aparar", value: 0, healing: 0 },
        enemyAttack: { sides: 4 as const, result: 4 },
        interventionEndsAt: 3_500,
        rerolledDieKinds: [],
      },
    };

    const resolved = applyCommand(run, { type: "RESOLVE_COMBAT_TURN", sequence: 1 }, at(3_500));

    expect(resolved.heroHp).toBe(7);
    expect(resolved.gold).toBe(8);
    expect(() => applyCommand(resolved, { type: "RESOLVE_COMBAT_TURN", sequence: 2 }, at(4_000))).toThrow();
  });

  it("ends the run when an enemy attack reduces persistent hero HP to zero", () => {
    const run = {
      ...readyToRollRun(),
      heroHp: 2,
      enemyHp: 20,
      phase: "combat-intervention" as const,
      combatTurn: {
        turn: 1,
        damage: { kind: "damage" as const, sides: 4 as const, faceIndex: 1, label: "Golpe", value: 1, healing: 0 },
        defense: { kind: "defense" as const, sides: 4 as const, faceIndex: 1, label: "Aparar", value: 0, healing: 0 },
        enemyAttack: { sides: 4 as const, result: 4 },
        interventionEndsAt: 3_500,
        rerolledDieKinds: [],
      },
    };

    const resolved = applyCommand(run, { type: "RESOLVE_COMBAT_TURN", sequence: 1 }, at(3_500));

    expect(resolved).toMatchObject({ phase: "complete", heroHp: 0, enemyHp: 19 });
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

  it("accepts only intent fields for interactive room commands", () => {
    expect(() => runCommandSchema.parse({
      type: "BUY_MERCHANT_ITEM", offerId: "merchant-1", commandId: "buy-1", price: 1,
    })).toThrow();
    expect(() => runCommandSchema.parse({
      type: "CHOOSE_TREASURE", offerId: "treasure-1", commandId: "treasure-1", gold: 999,
    })).toThrow();
    expect(() => runCommandSchema.parse({
      type: "CHOOSE_EVENT_OPTION", offerId: "event-1", commandId: "event-1", damage: 0,
    })).toThrow();
    expect(() => runCommandSchema.parse({
      type: "CHOOSE_TREASURE", offerId: "treasure-1", commandId: "treasure-2", reward: "item",
    })).toThrow();
  });

  it("creates authoritative room offers and blocks map routes", () => {
    for (const type of ["merchant", "treasure", "event"] as const) {
      const entered = enterInteractiveRoom(type);
      expect(entered.pendingRoom?.kind).toBe(type);
      expect(entered.availableRoomIds).toEqual([]);
      expect(() => applyCommand(entered, {
        type: "CHOOSE_ROOM", sequence: 2, roomId: entered.map.layers[1]!.nodes[0]!.id,
      })).toThrow(/pending|available/i);
    }
  });

  it("buys only active merchant offers, checks funds and prevents duplicate passives", () => {
    const base = createRun({ seed: "merchant-tests", heroId: "squire" });
    const offer = createMerchantOffer(base.seed, 0, Object.keys(RUN_ITEMS));
    const sword = offer.options.find((option) => RUN_ITEMS[option.itemId].kind === "passive")!;
    const run = { ...base, gold: 12, pendingRoom: { kind: "merchant" as const, offer } };

    expect(() => applyCommand(run, {
      type: "BUY_MERCHANT_ITEM", offerId: "merchant-forged", commandId: "buy-forged",
    })).toThrow(/offer/i);
    const bought = applyCommand(run, {
      type: "BUY_MERCHANT_ITEM", offerId: sword.offerId, commandId: "buy-sword",
    });
    expect(bought.inventory).toContain(sword.itemId);
    expect(bought.gold).toBe(12 - RUN_ITEMS[sword.itemId].price);
    expect(() => applyCommand(bought, {
      type: "BUY_MERCHANT_ITEM", offerId: sword.offerId, commandId: "buy-again",
    })).toThrow(/offer/i);
    expect(applyCommand(bought, {
      type: "BUY_MERCHANT_ITEM", offerId: sword.offerId, commandId: "buy-sword",
    })).toBe(bought);

    const poor = { ...run, gold: 0 };
    expect(() => applyCommand(poor, {
      type: "BUY_MERCHANT_ITEM", offerId: sword.offerId, commandId: "buy-poor",
    })).toThrow(/gold/i);

    const renameSwordOffer = (option: (typeof offer.options)[number]) => option.offerId === sword.offerId
      ? { ...option, offerId: "merchant-same-passive" }
      : option;
    const repeatedPassive = {
      ...run,
      inventory: [sword.itemId],
      pendingRoom: {
        kind: "merchant" as const,
        offer: { ...offer, options: [
          renameSwordOffer(offer.options[0]),
          renameSwordOffer(offer.options[1]),
          renameSwordOffer(offer.options[2]),
        ] as const },
      },
    };
    expect(() => applyCommand(repeatedPassive, {
      type: "BUY_MERCHANT_ITEM", offerId: "merchant-same-passive", commandId: "buy-repeat-passive",
    })).toThrow(/passive/i);
  });

  it("leaves merchant and unlocks only official next rooms", () => {
    const entered = enterInteractiveRoom("merchant");
    const current = entered.map.layers[0]!.nodes.find((node) => node.id === entered.currentRoomId)!;
    const left = applyCommand(entered, { type: "LEAVE_MERCHANT", commandId: "leave-1" });
    expect(left.pendingRoom).toBeNull();
    expect(left.availableRoomIds).toEqual(current.nextNodeIds);
  });

  it("allows exactly one authoritative treasure choice", () => {
    const base = createRun({ seed: "treasure-tests", heroId: "squire" });
    const offer = createTreasureOffer(base.seed, 0, Object.keys(RUN_ITEMS));
    const gold = offer.options.find((option) => option.payload.kind === "gold")!;
    const run = { ...base, currentRoomId: base.map.layers[0]!.nodes[0]!.id, pendingRoom: { kind: "treasure" as const, offer } };
    expect(() => applyCommand(run, {
      type: "CHOOSE_TREASURE", offerId: "treasure-forged", commandId: "take-forged",
    })).toThrow(/offer/i);
    const chosen = applyCommand(run, {
      type: "CHOOSE_TREASURE", offerId: gold.offerId, commandId: "take-gold",
    });
    expect(chosen.gold).toBeGreaterThan(run.gold);
    expect(chosen.pendingRoom).toBeNull();
    expect(applyCommand(chosen, {
      type: "CHOOSE_TREASURE", offerId: gold.offerId, commandId: "take-gold",
    })).toBe(chosen);
    expect(() => applyCommand(chosen, {
      type: "CHOOSE_TREASURE", offerId: offer.options[1].offerId, commandId: "take-twice",
    })).toThrow(/treasure/i);
    expect(chosen.availableRoomIds).toEqual(base.map.layers[0]!.nodes[0]!.nextNodeIds);
  });

  it("clamps treasure essence at maxEssence", () => {
    const base = createRun({ seed: "treasure-essence", heroId: "squire" });
    const generated = createTreasureOffer(base.seed, 0, Object.keys(RUN_ITEMS));
    const option = { ...generated.options[0], payload: { kind: "essence" as const, amount: 5 } };
    const offer = { ...generated, options: [option, generated.options[1], generated.options[2]] as const };
    const run = { ...base, essence: 1, maxEssence: 2, currentRoomId: base.map.layers[0]!.nodes[0]!.id, pendingRoom: { kind: "treasure" as const, offer } };

    const chosen = applyCommand(run, {
      type: "CHOOSE_TREASURE", offerId: option.offerId, commandId: "take-essence",
    });

    expect(chosen.essence).toBe(2);
  });

  it("grants a treasure passive without charging gold", () => {
    const base = createRun({ seed: "treasure-passive", heroId: "squire" });
    const generated = createTreasureOffer(base.seed, 0, Object.keys(RUN_ITEMS));
    const option = { ...generated.options[0], payload: { kind: "item" as const, itemId: "sharp-sword" as const } };
    const offer = { ...generated, options: [option, generated.options[1], generated.options[2]] as const };
    const run = { ...base, currentRoomId: base.map.layers[0]!.nodes[0]!.id, pendingRoom: { kind: "treasure" as const, offer } };

    const chosen = applyCommand(run, {
      type: "CHOOSE_TREASURE", offerId: option.offerId, commandId: "take-passive",
    });

    expect(chosen.gold).toBe(run.gold);
    expect(chosen.inventory).toContain("sharp-sword");
  });

  it("uses a treasure potion for free without storing it", () => {
    const base = createRun({ seed: "treasure-potion", heroId: "squire" });
    const generated = createTreasureOffer(base.seed, 0, Object.keys(RUN_ITEMS));
    const option = { ...generated.options[0], payload: { kind: "item" as const, itemId: "healing-potion" as const } };
    const offer = { ...generated, options: [option, generated.options[1], generated.options[2]] as const };
    const run = { ...base, heroHp: 20, currentRoomId: base.map.layers[0]!.nodes[0]!.id, pendingRoom: { kind: "treasure" as const, offer } };

    const chosen = applyCommand(run, {
      type: "CHOOSE_TREASURE", offerId: option.offerId, commandId: "take-potion",
    });

    expect(chosen.heroHp).toBe(24);
    expect(chosen.gold).toBe(run.gold);
    expect(chosen.inventory).not.toContain("healing-potion");
  });

  it("applies the tax amulet bonus to treasure gold", () => {
    const base = createRun({ seed: "treasure-tax", heroId: "squire" });
    const generated = createTreasureOffer(base.seed, 0, Object.keys(RUN_ITEMS));
    const option = { ...generated.options[0], payload: { kind: "gold" as const, amount: 10 } };
    const offer = { ...generated, options: [option, generated.options[1], generated.options[2]] as const };
    const run = { ...base, inventory: ["tax-amulet" as const], currentRoomId: base.map.layers[0]!.nodes[0]!.id, pendingRoom: { kind: "treasure" as const, offer } };

    const chosen = applyCommand(run, {
      type: "CHOOSE_TREASURE", offerId: option.offerId, commandId: "take-tax-gold",
    });

    expect(chosen.gold).toBe(run.gold + 12);
  });

  it("keeps event result pending until acknowledgement", () => {
    const entered = enterInteractiveRoom("event");
    if (entered.pendingRoom?.kind !== "event") throw new Error("event room expected");
    expect(() => applyCommand(entered, {
      type: "ACKNOWLEDGE_EVENT_RESULT", commandId: "ack-early",
    })).toThrow(/result/i);
    expect(() => applyCommand(entered, {
      type: "CHOOSE_EVENT_OPTION", offerId: "event-forged", commandId: "event-forged",
    })).toThrow(/offer/i);
    const choice = entered.pendingRoom.offer.options[0]!;
    const resolved = applyCommand(entered, {
      type: "CHOOSE_EVENT_OPTION", offerId: choice.offerId, commandId: "event-choice",
    });
    expect(resolved.pendingRoom?.kind).toBe("event");
    if (resolved.pendingRoom?.kind !== "event") throw new Error("event result expected");
    expect(resolved.pendingRoom.result).not.toBeNull();
    const acknowledged = applyCommand(resolved, {
      type: "ACKNOWLEDGE_EVENT_RESULT", commandId: "event-ack",
    });
    expect(acknowledged.pendingRoom).toBeNull();
    expect(acknowledged.availableRoomIds.length).toBeGreaterThan(0);
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

  it("accepts only event option ids present in the legacy official offer", () => {
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
