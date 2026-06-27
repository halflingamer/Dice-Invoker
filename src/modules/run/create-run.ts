import { loadSeason } from "@/modules/content/content-loader";
import { seasonOne } from "@/modules/content/season-1";
import { generateMap } from "@/modules/game-engine/map";
import { createHeroProgression } from "@/modules/game-engine/progression";
import type { RunState } from "./state";

type CreateRunInput = Readonly<{ seed: string; guardianId: string }>;

export function createRun(input: CreateRunInput): RunState {
  if (input.seed.length < 8) throw new Error("seed must contain at least 8 characters");

  const season = loadSeason(seasonOne);
  const guardian = seasonOne.guardians.find((candidate) => candidate.id === input.guardianId);
  if (!guardian) throw new Error("unknown guardian");
  if (guardian.unlock.kind !== "starter") throw new Error("guardian is not unlocked");
  const hero = season.heroes.find((candidate) => candidate.id === "squire")!;

  const enemy = season.enemies.find((candidate) => candidate.id === "receipt-slime");
  if (!enemy) throw new Error("starter enemy is missing");
  const invader = seasonOne.invaders.find((candidate) => candidate.id === "torch-bearer")!;
  const campaignPhase = seasonOne.phases[0]!;
  const map = generateMap({ seed: input.seed, phaseIndex: campaignPhase.index, roomCount: campaignPhase.roomCount });
  const progression = createHeroProgression(hero.id, season);

  return {
    seed: input.seed,
    sequence: 0,
    map,
    rngCursors: {
      map: map.rngCursor,
      encounter: 0,
      combat: 0,
      reward: 0,
      event: 0,
    },
    phase: "map-reveal",
    campaignPhaseIndex: 1,
    completedRoomCount: 0,
    outcome: "ongoing",
    guardianId: guardian.id,
    unlockedGuardianIds: [guardian.id],
    guardianHp: guardian.maxHp,
    guardianMaxHp: guardian.maxHp,
    guardianNaturalDefense: guardian.naturalDefense,
    invaderId: invader.id,
    invaderHp: invader.maxHp,
    invaderMaxHp: invader.maxHp,
    invaderNaturalDefense: invader.naturalDefense,
    heroId: hero.id,
    heroHp: guardian.maxHp,
    heroMaxHp: guardian.maxHp,
    enemyId: enemy.id,
    enemyHp: enemy.maxHp,
    combatRound: 0,
    combatTurn: null,
    essence: 2,
    maxEssence: 2,
    gold: 12,
    inventory: [],
    consumables: {},
    equipment: { [guardian.id]: { weapon: null, armor: null, accessory: null } },
    pendingRoom: null,
    handledRoomCommandIds: [],
    purchasedMerchantOfferIds: [],
    hasInsurance: false,
    equippedDieIds: [...hero.startingDiceIds],
    rolls: [],
    visitedRoomIds: [],
    currentLayer: 0,
    availableRoomIds: map.layers[0]!.nodes.map((node) => node.id),
    currentRoomId: null,
    currentClassStageId: progression.currentStageId,
    xp: progression.xp,
    pendingPromotionIds: [],
    rewardOffer: null,
    eventOffer: null,
    eventAuditTrail: [],
  };
}
