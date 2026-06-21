import type { EventAuditRecord, EventChoiceResult, EventOffer } from "@/modules/game-engine/events";
import type { ConsumableStacks, EquipmentByGuardian, RunItemId } from "@/modules/game-engine/economy";
import type { RunMap } from "@/modules/game-engine/map";
import type { RandomChannel } from "@/modules/game-engine/rng";
import type { MerchantOffer, RewardOffer, TreasureOffer } from "@/modules/game-engine/rewards";
import type { ClassCombatDice, CombatDieKind } from "@/modules/game-engine/types";

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

export type RunOutcome = "ongoing" | "victory" | "defeat";

export type DieRoll = Readonly<{
  dieId: string;
  sides: number;
  result: number;
  locked: boolean;
}>;

export type CombatTurnState = Readonly<ClassCombatDice & {
  turn: number;
  enemyAttack: Readonly<{ sides: 4 | 6 | 8; result: number }>;
  interventionEndsAt: number;
  rerolledDieKinds: readonly CombatDieKind[];
}>;

export type PendingRoom =
  | Readonly<{ kind: "merchant"; offer: MerchantOffer }>
  | Readonly<{ kind: "treasure"; offer: TreasureOffer }>
  | Readonly<{ kind: "event"; offer: EventOffer; result: EventChoiceResult | null }>
  | null;

export type RunState = Readonly<{
  seed: string;
  sequence: number;
  map: RunMap;
  rngCursors: Readonly<Record<RandomChannel, number>>;
  phase: RunPhase;
  campaignPhaseIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  completedRoomCount: number;
  outcome: RunOutcome;
  guardianId: string;
  unlockedGuardianIds: readonly string[];
  guardianHp: number;
  guardianMaxHp: number;
  guardianNaturalDefense: number;
  invaderId: string | null;
  invaderHp: number;
  invaderMaxHp: number;
  invaderNaturalDefense: number;
  heroId: string;
  heroHp: number;
  heroMaxHp: number;
  enemyId: string;
  enemyHp: number;
  combatRound: number;
  combatTurn: CombatTurnState | null;
  essence: number;
  maxEssence: number;
  gold: number;
  inventory: readonly RunItemId[];
  consumables: ConsumableStacks;
  equipment: EquipmentByGuardian;
  pendingRoom: PendingRoom;
  handledRoomCommandIds: readonly string[];
  purchasedMerchantOfferIds: readonly string[];
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
