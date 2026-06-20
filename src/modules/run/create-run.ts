import { loadSeason } from "@/modules/content/content-loader";
import { seasonOne } from "@/modules/content/season-1";
import { generateMap } from "@/modules/game-engine/map";
import { createHeroProgression } from "@/modules/game-engine/progression";
import type { RunState } from "./state";

type CreateRunInput = Readonly<{ seed: string; heroId: string }>;

export function createRun(input: CreateRunInput): RunState {
  if (input.seed.length < 8) throw new Error("seed must contain at least 8 characters");

  const season = loadSeason(seasonOne);
  const hero = season.heroes.find((candidate) => candidate.id === input.heroId);
  if (!hero) throw new Error("unknown hero");
  if (hero.unlock.kind !== "starter") throw new Error("hero is not unlocked");

  const enemy = season.enemies.find((candidate) => candidate.id === "receipt-slime");
  if (!enemy) throw new Error("starter enemy is missing");
  const map = generateMap(input.seed);
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
    heroId: hero.id,
    heroHp: hero.maxHp,
    heroMaxHp: hero.maxHp,
    enemyId: enemy.id,
    enemyHp: enemy.maxHp,
    combatRound: 0,
    combatTurn: null,
    essence: 2,
    maxEssence: 2,
    gold: 12,
    inventory: [],
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
