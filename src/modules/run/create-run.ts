import { loadSeason } from "@/modules/content/content-loader";
import { seasonOne } from "@/modules/content/season-1";
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

  return {
    seed: input.seed,
    sequence: 0,
    rngCursor: 0,
    phase: "ready-to-roll",
    heroId: hero.id,
    heroHp: hero.maxHp,
    heroMaxHp: hero.maxHp,
    enemyId: enemy.id,
    enemyHp: enemy.maxHp,
    essence: 2,
    maxEssence: 2,
    gold: 0,
    hasInsurance: false,
    equippedDieIds: [...hero.startingDiceIds],
    rolls: [],
    availableRoomIds: [],
    currentRoomId: "room-1-1",
    rewardOffer: null,
    eventOffer: null,
    eventAuditTrail: [],
  };
}
