import { loadSeason } from "@/modules/content/content-loader";
import { seasonOne } from "@/modules/content/season-1";
import { createNamedRollStream } from "@/modules/game-engine/rng";
import { resolveEventChoice } from "@/modules/game-engine/events";
import { chooseReward } from "@/modules/game-engine/rewards";
import { applyPromotion } from "@/modules/game-engine/progression";
import { runCommandSchema, type RunCommand } from "./command-schema";
import type { DieRoll, RunState } from "./state";

const season = loadSeason(seasonOne);
const diceById = new Map(season.dice.map((die) => [die.id, die]));

function requirePhase(state: RunState, phase: RunState["phase"]) {
  if (state.phase !== phase) {
    throw new Error(`command is not allowed in phase ${state.phase}`);
  }
}

function assertSequence(state: RunState, command: RunCommand) {
  if (command.sequence !== state.sequence + 1) {
    throw new Error(`invalid sequence: expected ${state.sequence + 1}`);
  }
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

export function applyCommand(state: RunState, input: unknown): RunState {
  const command = runCommandSchema.parse(input);
  assertSequence(state, command);

  switch (command.type) {
    case "ACKNOWLEDGE_MAP_REVEAL":
      requirePhase(state, "map-reveal");
      return { ...state, phase: "room-choice", sequence: command.sequence };
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
      return assertNever(command);
  }
}
