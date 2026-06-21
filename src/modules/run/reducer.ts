import { loadSeason } from "@/modules/content/content-loader";
import { seasonOne } from "@/modules/content/season-1";
import { rollClassCombatDice, rollClassCombatDie, resolveLegacyCombatExchange } from "@/modules/game-engine/combat";
import { createNamedRollStream } from "@/modules/game-engine/rng";
import { createEventOffer, resolveEventChoice } from "@/modules/game-engine/events";
import { RUN_ITEMS, applyCombatBonuses, applyGoldBonus, purchaseLegacyItem, type RunItemId } from "@/modules/game-engine/economy";
import { chooseMerchantItem, chooseReward, chooseTreasureReward, createMerchantOffer, createTreasureOffer } from "@/modules/game-engine/rewards";
import { applyPromotion, awardExperience, getPromotionChoices } from "@/modules/game-engine/progression";
import { runCommandSchema, type RunCommand } from "./command-schema";
import type { DieRoll, RunState } from "./state";

const season = loadSeason(seasonOne);
const diceById = new Map(season.dice.map((die) => [die.id, die]));
const INTERVENTION_WINDOW_MS = 2_500;
const ROOM_XP = { combat: 35, elite: 65, treasure: 20, merchant: 20, event: 30, rest: 20, boss: 100 } as const;
const COMBAT_GOLD = { combat: 3, elite: 7, boss: 15 } as const;

type CommandContext = Readonly<{ now(): number }>;

function requirePhase(state: RunState, phase: RunState["phase"]) {
  if (state.phase !== phase) {
    throw new Error(`command is not allowed in phase ${state.phase}`);
  }
}

function assertSequence(state: RunState, command: RunCommand) {
  if (!("sequence" in command)) return;
  if (command.sequence !== state.sequence + 1) {
    throw new Error(`invalid sequence: expected ${state.sequence + 1}`);
  }
}

function isRoomCommand(command: RunCommand): command is Extract<RunCommand, { commandId: string }> {
  return "commandId" in command;
}

function rememberRoomCommand(state: RunState, commandId: string): Pick<RunState, "handledRoomCommandIds" | "sequence"> {
  return { handledRoomCommandIds: [...state.handledRoomCommandIds, commandId], sequence: state.sequence + 1 };
}

function nextRoomIds(state: RunState): readonly string[] {
  const node = state.currentRoomId
    ? state.map.layers.flatMap((layer) => layer.nodes).find((candidate) => candidate.id === state.currentRoomId)
    : undefined;
  return [...(node?.nextNodeIds ?? [])];
}

function currentCombatRank(state: RunState): keyof typeof COMBAT_GOLD {
  const type = state.currentRoomId
    ? state.map.layers.flatMap((layer) => layer.nodes).find((node) => node.id === state.currentRoomId)?.type
    : undefined;
  return type === "elite" || type === "boss" ? type : "combat";
}

function grantTreasureItem(state: RunState, itemId: RunItemId): Pick<RunState, "heroHp" | "inventory"> {
  const item = RUN_ITEMS[itemId];
  if (item.kind === "consumable") {
    return { heroHp: Math.min(state.heroMaxHp, state.heroHp + 6), inventory: state.inventory };
  }
  if (state.inventory.includes(itemId)) throw new Error("treasure item is not available");
  return { heroHp: state.heroHp, inventory: [...state.inventory, itemId] };
}

function rollEquippedDice(state: RunState): Pick<RunState, "rolls" | "rngCursors"> {
  const stream = createNamedRollStream(state.seed, "combat", state.rngCursors.combat);
  const rolls = state.equippedDieIds.map((dieId): DieRoll => {
    const die = diceById.get(dieId);
    if (!die) throw new Error(`equipped die ${dieId} is missing from content`);
    return { dieId, sides: die.sides, result: stream.roll(die.sides), locked: false };
  });
  return {
    rolls,
    rngCursors: { ...state.rngCursors, combat: stream.cursor() },
  };
}

function assertNever(value: never): never {
  throw new Error(`unsupported command: ${JSON.stringify(value)}`);
}

function applyLegacyCommand(
  state: RunState,
  input: unknown,
  context: CommandContext = { now: () => Date.now() },
): RunState {
  const command = runCommandSchema.parse(input);
  if (isRoomCommand(command) && state.handledRoomCommandIds.includes(command.commandId)) return state;
  assertSequence(state, command);

  switch (command.type) {
    case "ACKNOWLEDGE_MAP_REVEAL":
      requirePhase(state, "map-reveal");
      return { ...state, phase: "room-choice", sequence: command.sequence };
    case "BEGIN_COMBAT_TURN": {
      requirePhase(state, "ready-to-roll");
      if (state.enemyHp <= 0) throw new Error("combat enemy is already defeated");
      const stage = season.classStages.find((candidate) => candidate.id === state.currentClassStageId);
      if (!stage) throw new Error("current class stage is missing");
      const stream = createNamedRollStream(state.seed, "combat", state.rngCursors.combat);
      const dice = rollClassCombatDice(stage, (sides) => stream.roll(sides));
      const enemySides = ({ combat: 4, elite: 6, boss: 8 } as const)[currentCombatRank(state)];
      return {
        ...state,
        sequence: command.sequence,
        phase: "combat-intervention",
        combatRound: state.combatRound + 1,
        combatTurn: {
          turn: state.combatRound + 1,
          ...dice,
          enemyAttack: { sides: enemySides, result: stream.roll(enemySides) },
          interventionEndsAt: context.now() + INTERVENTION_WINDOW_MS,
          rerolledDieKinds: [],
        },
        rngCursors: { ...state.rngCursors, combat: stream.cursor() },
      };
    }
    case "REROLL_COMBAT_DIE": {
      requirePhase(state, "combat-intervention");
      if (!state.combatTurn) throw new Error("combat turn is missing");
      if (context.now() >= state.combatTurn.interventionEndsAt) {
        throw new Error("combat intervention window has ended");
      }
      if (state.essence < 1) throw new Error("not enough essence");
      if (state.combatTurn.rerolledDieKinds.includes(command.dieKind)) {
        throw new Error("combat die was already rerolled");
      }
      const stage = season.classStages.find((candidate) => candidate.id === state.currentClassStageId);
      if (!stage) throw new Error("current class stage is missing");
      const stream = createNamedRollStream(state.seed, "combat", state.rngCursors.combat);
      const rerolled = rollClassCombatDie(stage, command.dieKind, (sides) => stream.roll(sides));
      return {
        ...state,
        sequence: command.sequence,
        essence: state.essence - 1,
        combatTurn: {
          ...state.combatTurn,
          [command.dieKind]: rerolled,
          rerolledDieKinds: [...state.combatTurn.rerolledDieKinds, command.dieKind],
        },
        rngCursors: { ...state.rngCursors, combat: stream.cursor() },
      };
    }
    case "RESOLVE_COMBAT_TURN": {
      requirePhase(state, "combat-intervention");
      if (!state.combatTurn) throw new Error("combat turn is missing");
      if (context.now() < state.combatTurn.interventionEndsAt) {
        throw new Error("combat intervention window is still active");
      }
      const stats = applyCombatBonuses({
        damage: state.combatTurn.damage.value,
        defense: state.combatTurn.defense.value,
      }, state.inventory);
      const healedHeroHp = Math.min(
        state.heroMaxHp,
        state.heroHp + state.combatTurn.damage.healing + state.combatTurn.defense.healing,
      );
      const result = resolveLegacyCombatExchange({
        heroHp: healedHeroHp,
        enemyHp: state.enemyHp,
        heroDamage: stats.damage,
        heroDefense: stats.defense,
        enemyAttack: state.combatTurn.enemyAttack.result,
      });
      if (!result.victory && !result.defeat) {
        return {
          ...state,
          sequence: command.sequence,
          phase: "ready-to-roll",
          heroHp: result.heroHp,
          enemyHp: result.enemyHp,
          combatTurn: null,
        };
      }
      if (result.defeat) {
        return {
          ...state,
          sequence: command.sequence,
          phase: "complete",
          heroHp: 0,
          enemyHp: result.enemyHp,
          combatTurn: null,
        };
      }

      const currentNode = state.currentRoomId
        ? state.map.layers.flatMap((layer) => layer.nodes).find((node) => node.id === state.currentRoomId)
        : undefined;
      const progressed = awardExperience(
        { currentStageId: state.currentClassStageId, xp: state.xp },
        ROOM_XP[currentNode?.type ?? "combat"],
      );
      const promotionChoices = getPromotionChoices(progressed, season.classStages, { roomResolved: true });
      const completedRun = currentNode?.type === "boss" || state.currentLayer === state.map.layers.length;
      const goldReward = applyGoldBonus(COMBAT_GOLD[currentCombatRank(state)], state.inventory);
      return {
        ...state,
        sequence: command.sequence,
        phase: completedRun ? "complete" : promotionChoices.length > 0 ? "promotion" : "room-choice",
        heroHp: result.heroHp,
        enemyHp: 0,
        combatTurn: null,
        gold: state.gold + goldReward,
        xp: progressed.xp,
        pendingPromotionIds: promotionChoices.map((stage) => stage.id),
        availableRoomIds: completedRun ? [] : [...(currentNode?.nextNodeIds ?? [])],
      };
    }
    case "ROLL_DICE": {
      requirePhase(state, "ready-to-roll");
      const rolled = rollEquippedDice(state);
      return { ...state, ...rolled, phase: "rolled", sequence: command.sequence };
    }
    case "LOCK_RESULT": {
      requirePhase(state, "rolled");
      if (!state.equippedDieIds.includes(command.dieId)) throw new Error("die is not equipped");
      return {
        ...state,
        sequence: command.sequence,
        rolls: state.rolls.map((roll) =>
          roll.dieId === command.dieId ? { ...roll, locked: true } : roll,
        ),
      };
    }
    case "REROLL": {
      requirePhase(state, "rolled");
      if (state.essence < 1) throw new Error("not enough essence");
      if (new Set(command.dieIds).size !== command.dieIds.length) {
        throw new Error("duplicate die id in reroll");
      }
      const stream = createNamedRollStream(state.seed, "combat", state.rngCursors.combat);
      const requested = new Set(command.dieIds);
      for (const dieId of requested) {
        if (!state.equippedDieIds.includes(dieId)) throw new Error(`die ${dieId} is not equipped`);
        const current = state.rolls.find((roll) => roll.dieId === dieId);
        if (!current) throw new Error(`die ${dieId} has not been rolled`);
        if (current.locked) throw new Error(`die ${dieId} is locked`);
      }
      const rolls = state.rolls.map((roll) =>
        requested.has(roll.dieId) ? { ...roll, result: stream.roll(roll.sides) } : roll,
      );
      return {
        ...state,
        rolls,
        rngCursors: { ...state.rngCursors, combat: stream.cursor() },
        essence: state.essence - 1,
        sequence: command.sequence,
      };
    }
    case "ACTIVATE_RESULTS":
      requirePhase(state, "rolled");
      throw new Error("result activation is introduced with combat orchestration");
    case "CHOOSE_ROOM": {
      requirePhase(state, "room-choice");
      if (state.pendingRoom) throw new Error("a room is still pending");
      const currentNode = state.currentRoomId
        ? state.map.layers.flatMap((layer) => layer.nodes).find((node) => node.id === state.currentRoomId)
        : null;
      const reachableIds = currentNode
        ? currentNode.nextNodeIds
        : state.map.layers[0]!.nodes.map((node) => node.id);
      if (!reachableIds.includes(command.roomId) || !state.availableRoomIds.includes(command.roomId)) {
        throw new Error("room is not available or reachable");
      }
      if (state.visitedRoomIds.includes(command.roomId)) throw new Error("room was already visited");
      const selectedLayer = state.map.layers.find((layer) => layer.nodes.some((node) => node.id === command.roomId));
      if (!selectedLayer || selectedLayer.index !== state.currentLayer + 1) {
        throw new Error("room is not on the next layer");
      }
      const selectedNode = selectedLayer.nodes.find((node) => node.id === command.roomId)!;
      if (selectedNode.type === "merchant") {
        const offer = createMerchantOffer(state.seed, state.rngCursors.reward, Object.keys(RUN_ITEMS));
        return {
          ...state, sequence: command.sequence, phase: "room-choice", currentRoomId: command.roomId,
          currentLayer: selectedLayer.index, visitedRoomIds: [...state.visitedRoomIds, command.roomId],
          availableRoomIds: [], pendingRoom: { kind: "merchant", offer },
          rngCursors: { ...state.rngCursors, reward: offer.rngCursor },
        };
      }
      if (selectedNode.type === "treasure") {
        const candidates = Object.values(RUN_ITEMS)
          .filter((item) => item.kind === "consumable" || !state.inventory.includes(item.id))
          .map((item) => item.id);
        const offer = createTreasureOffer(state.seed, state.rngCursors.reward, candidates);
        return {
          ...state, sequence: command.sequence, phase: "room-choice", currentRoomId: command.roomId,
          currentLayer: selectedLayer.index, visitedRoomIds: [...state.visitedRoomIds, command.roomId],
          availableRoomIds: [], pendingRoom: { kind: "treasure", offer },
          rngCursors: { ...state.rngCursors, reward: offer.rngCursor },
        };
      }
      if (selectedNode.type === "event") {
        const event = seasonOne.events.find((candidate) => candidate.id === "goblin-insurance");
        if (!event) throw new Error("event content is unavailable");
        const offer = createEventOffer(event, state.seed, state.rngCursors.event);
        return {
          ...state, sequence: command.sequence, phase: "room-choice", currentRoomId: command.roomId,
          currentLayer: selectedLayer.index, visitedRoomIds: [...state.visitedRoomIds, command.roomId],
          availableRoomIds: [], pendingRoom: { kind: "event", offer, result: null },
          rngCursors: { ...state.rngCursors, event: offer.rngCursor },
        };
      }
      return {
        ...state,
        sequence: command.sequence,
        phase: "ready-to-roll",
        currentRoomId: command.roomId,
        currentLayer: selectedLayer.index,
        visitedRoomIds: [...state.visitedRoomIds, command.roomId],
        availableRoomIds: [],
      };
    }
    case "BUY_MERCHANT_ITEM": {
      if (!state.pendingRoom || state.pendingRoom.kind !== "merchant") throw new Error("merchant offer is not active");
      if (state.purchasedMerchantOfferIds.includes(command.offerId)) throw new Error("merchant offer is not active");
      let option;
      try { option = chooseMerchantItem(state.pendingRoom.offer, command.offerId); }
      catch { throw new Error("merchant offer is not active"); }
      const purchased = purchaseLegacyItem(state, option.itemId);
      return {
        ...state, ...purchased, ...rememberRoomCommand(state, command.commandId),
        purchasedMerchantOfferIds: [...state.purchasedMerchantOfferIds, command.offerId],
      };
    }
    case "LEAVE_MERCHANT":
      if (!state.pendingRoom || state.pendingRoom.kind !== "merchant") throw new Error("merchant room is not active");
      return {
        ...state, ...rememberRoomCommand(state, command.commandId), pendingRoom: null,
        availableRoomIds: nextRoomIds(state), phase: "room-choice",
      };
    case "CHOOSE_TREASURE": {
      if (!state.pendingRoom || state.pendingRoom.kind !== "treasure") throw new Error("treasure offer is not active");
      let option;
      try { option = chooseTreasureReward(state.pendingRoom.offer, command.offerId); }
      catch { throw new Error("treasure offer is not active"); }
      let gold = state.gold;
      let essence = state.essence;
      let heroHp = state.heroHp;
      let inventory = state.inventory;
      if (option.payload.kind === "gold") gold += applyGoldBonus(option.payload.amount, state.inventory);
      if (option.payload.kind === "essence") {
        essence = Math.min(state.maxEssence, essence + option.payload.amount);
      }
      if (option.payload.kind === "item") ({ heroHp, inventory } = grantTreasureItem(state, option.payload.itemId));
      return {
        ...state, ...rememberRoomCommand(state, command.commandId), gold, essence, heroHp, inventory,
        pendingRoom: null, availableRoomIds: nextRoomIds(state), phase: "room-choice",
      };
    }
    case "CHOOSE_REWARD": {
      requirePhase(state, "reward");
      if (!state.rewardOffer) throw new Error("no reward is currently offered");
      const reward = chooseReward(state.rewardOffer, command.rewardId);
      return {
        ...state,
        sequence: command.sequence,
        phase: "room-choice",
        rewardOffer: null,
        equippedDieIds: state.equippedDieIds.includes(reward.dieId)
          ? state.equippedDieIds
          : [...state.equippedDieIds, reward.dieId],
      };
    }
    case "CHOOSE_EVENT_OPTION": {
      if (!("sequence" in command)) {
        if (!state.pendingRoom || state.pendingRoom.kind !== "event" || state.pendingRoom.result) {
          throw new Error("event offer is not active");
        }
        let result;
        try {
          result = resolveEventChoice({
            offer: state.pendingRoom.offer, offerId: command.offerId, seed: state.seed,
            rngCursor: state.rngCursors.event, gold: state.gold,
          });
        } catch (error) {
          if (error instanceof Error && /gold/i.test(error.message)) throw error;
          throw new Error("event offer is not active");
        }
        return {
          ...state, ...rememberRoomCommand(state, command.commandId), gold: result.gold,
          hasInsurance: state.hasInsurance || result.hasInsurance,
          heroHp: Math.max(0, Math.min(state.heroMaxHp, state.heroHp + result.hpDelta)),
          rngCursors: { ...state.rngCursors, event: result.rngCursor },
          eventAuditTrail: [...state.eventAuditTrail, result.audit],
          pendingRoom: { ...state.pendingRoom, result },
        };
      }
      requirePhase(state, "event");
      if (!state.eventOffer) throw new Error("no event option is currently offered");
      const result = resolveEventChoice({
        offer: state.eventOffer,
        offerId: command.optionId,
        seed: state.seed,
        rngCursor: state.rngCursors.event,
        gold: state.gold,
      });
      return {
        ...state,
        sequence: command.sequence,
        phase: "room-choice",
        eventOffer: null,
        gold: result.gold,
        hasInsurance: state.hasInsurance || result.hasInsurance,
        heroHp: Math.max(0, Math.min(state.heroMaxHp, state.heroHp + result.hpDelta)),
        rngCursors: { ...state.rngCursors, event: result.rngCursor },
        eventAuditTrail: [...state.eventAuditTrail, result.audit],
      };
    }
    case "ACKNOWLEDGE_EVENT_RESULT":
      if (!state.pendingRoom || state.pendingRoom.kind !== "event" || !state.pendingRoom.result) {
        throw new Error("event result is not available");
      }
      return {
        ...state, ...rememberRoomCommand(state, command.commandId), pendingRoom: null,
        availableRoomIds: nextRoomIds(state), phase: "room-choice",
      };
    case "CHOOSE_PROMOTION": {
      requirePhase(state, "promotion");
      if (!state.pendingPromotionIds.includes(command.classStageId)) {
        throw new Error("invalid promotion choice");
      }
      const progression = applyPromotion(
        { currentStageId: state.currentClassStageId, xp: state.xp },
        command.classStageId,
        season.classStages,
      );
      return {
        ...state,
        sequence: command.sequence,
        phase: "room-choice",
        currentClassStageId: progression.currentStageId,
        xp: progression.xp,
        pendingPromotionIds: [],
      };
    }
    default:
      return assertNever(command as never);
  }
}

const canonicalInvaderId = (legacyId: string): string => legacyId === "receipt-slime" ? "torch-bearer" : legacyId;
const legacyInvaderId = (canonicalId: string): string => canonicalId === "torch-bearer" ? "receipt-slime" : canonicalId;

function projectCanonicalState(state: RunState): RunState {
  const enemyId = state.invaderId === null ? state.enemyId : legacyInvaderId(state.invaderId);
  const enemyHp = state.invaderId === null ? 0 : state.invaderHp;
  if (state.heroHp === state.guardianHp && state.heroMaxHp === state.guardianMaxHp && state.enemyId === enemyId && state.enemyHp === enemyHp) return state;
  return { ...state, heroHp: state.guardianHp, heroMaxHp: state.guardianMaxHp, enemyId, enemyHp };
}

export function applyCommand(
  state: RunState,
  input: unknown,
  context: CommandContext = { now: () => Date.now() },
): RunState {
  const projected = projectCanonicalState(state);
  const next = applyLegacyCommand(projected, input, context);
  if (next === projected && projected === state) return state;
  const invaderId = next.enemyHp <= 0 && next.phase === "complete" ? next.invaderId : canonicalInvaderId(next.enemyId);
  const guardianHp = next.heroHp;
  const outcome = guardianHp === 0 ? "defeat" : next.phase === "complete" ? "victory" : "ongoing";
  return {
    ...next,
    guardianHp,
    guardianMaxHp: next.heroMaxHp,
    invaderId,
    invaderHp: next.enemyHp,
    outcome,
    completedRoomCount: next.visitedRoomIds.length,
  };
}
