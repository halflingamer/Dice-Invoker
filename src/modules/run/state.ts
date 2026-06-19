import type { EventAuditRecord, EventOffer } from "@/modules/game-engine/events";
import type { RewardOffer } from "@/modules/game-engine/rewards";

export type RunPhase = "ready-to-roll" | "rolled" | "room-choice" | "reward" | "event" | "complete";

export type DieRoll = Readonly<{
  dieId: string;
  sides: number;
  result: number;
  locked: boolean;
}>;

export type RunState = Readonly<{
  seed: string;
  sequence: number;
  rngCursor: number;
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
  availableRoomIds: readonly string[];
  currentRoomId: string | null;
  rewardOffer: RewardOffer | null;
  eventOffer: EventOffer | null;
  eventAuditTrail: readonly EventAuditRecord[];
}>;
