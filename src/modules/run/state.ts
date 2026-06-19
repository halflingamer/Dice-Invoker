import type { EventAuditRecord, EventOffer } from "@/modules/game-engine/events";
import type { RunMap } from "@/modules/game-engine/map";
import type { RandomChannel } from "@/modules/game-engine/rng";
import type { RewardOffer } from "@/modules/game-engine/rewards";

export type RunPhase =
  | "map-reveal"
  | "ready-to-roll"
  | "rolled"
  | "room-choice"
  | "combat-rolling"
  | "combat-intervention"
  | "combat-resolving"
  | "promotion"
  | "reward"
  | "event"
  | "complete";

export type DieRoll = Readonly<{
  dieId: string;
  sides: number;
  result: number;
  locked: boolean;
}>;

export type RunState = Readonly<{
  seed: string;
  sequence: number;
  map: RunMap;
  rngCursors: Readonly<Record<RandomChannel, number>>;
  phase: RunPhase;
  heroId: string;
  heroHp: number;
  heroMaxHp: number;
  enemyId: string;
  enemyHp: number;
  essence: number;
  maxEssence: number;
  gold: number;
  hasInsurance: boolean;
  equippedDieIds: readonly string[];
  rolls: readonly DieRoll[];
  visitedRoomIds: readonly string[];
  currentLayer: number;
  availableRoomIds: readonly string[];
  currentRoomId: string | null;
  currentClassStageId: string;
  xp: number;
  pendingPromotionIds: readonly string[];
  rewardOffer: RewardOffer | null;
  eventOffer: EventOffer | null;
  eventAuditTrail: readonly EventAuditRecord[];
}>;
