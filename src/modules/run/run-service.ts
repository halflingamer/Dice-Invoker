import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { loadSeason } from "@/modules/content/content-loader";
import { RUN_ITEMS, type RunItemId } from "@/modules/game-engine/economy";
import { seasonOne } from "@/modules/content/season-1";
import { createSeedCipher } from "@/modules/security/seed-cipher";
import type { RunCommand } from "./command-schema";
import { createRun } from "./create-run";
import { applyCommand } from "./reducer";
import type { RunState } from "./state";

type PersistedRunState = Omit<RunState, "seed">;
type PublicRunState = PersistedRunState;
type MutablePartialRunState = { -readonly [Key in keyof RunState]?: RunState[Key] };

type RunResponse = Readonly<{
  id: string;
  version: number;
  state: PublicRunState;
}>;

type Dependencies = Readonly<{
  prisma: PrismaClient;
  seedSecret: Buffer;
}>;

const persistedIdSchema = z.string().regex(/^[a-z0-9-]+$/).max(80);
const safeNonNegativeIntegerSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const safeIntegerSchema = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const runItemIdSchema = persistedIdSchema.refine((itemId): itemId is RunItemId => Object.hasOwn(RUN_ITEMS, itemId));
const merchantOptionSchema = z.object({ offerId: persistedIdSchema, itemId: runItemIdSchema }).strict();
const merchantOfferSchema = z.object({
  options: z.tuple([merchantOptionSchema, merchantOptionSchema, merchantOptionSchema]),
  rngCursor: safeNonNegativeIntegerSchema,
}).strict();
const treasurePayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("gold"), amount: safeNonNegativeIntegerSchema }).strict(),
  z.object({ kind: z.literal("item"), itemId: runItemIdSchema }).strict(),
  z.object({ kind: z.literal("essence"), amount: safeNonNegativeIntegerSchema }).strict(),
]);
const treasureOptionSchema = z.object({ offerId: persistedIdSchema, payload: treasurePayloadSchema }).strict();
const treasureOfferSchema = z.object({
  options: z.tuple([treasureOptionSchema, treasureOptionSchema, treasureOptionSchema]),
  rngCursor: safeNonNegativeIntegerSchema,
}).strict().superRefine((offer, context) => {
  const kinds = new Set(offer.options.map((option) => option.payload.kind));
  if (kinds.size !== 3) {
    context.addIssue({ code: "custom", message: "treasure reward kinds must be unique" });
  }
});
const eventOptionSchema = z.object({
  offerId: persistedIdSchema,
  optionId: persistedIdSchema,
  label: z.string().min(1).max(200),
}).strict();
const eventOfferSchema = z.object({
  eventId: persistedIdSchema,
  options: z.array(eventOptionSchema).min(1).max(12),
  rngCursor: safeNonNegativeIntegerSchema,
}).strict();
const eventAuditSchema = z.object({
  eventId: persistedIdSchema,
  optionId: persistedIdSchema,
  outcome: z.enum(["purchased", "ignored", "success", "failure", "resolved"]),
}).strict();
const eventResultSchema = z.object({
  gold: safeNonNegativeIntegerSchema,
  hasInsurance: z.boolean(),
  hpDelta: safeIntegerSchema,
  rngCursor: safeNonNegativeIntegerSchema,
  audit: eventAuditSchema,
}).strict();
const pendingRoomSchema = z.union([
  z.null(),
  z.object({ kind: z.literal("merchant"), offer: merchantOfferSchema }).strict(),
  z.object({ kind: z.literal("treasure"), offer: treasureOfferSchema }).strict(),
  z.object({
    kind: z.literal("event"),
    offer: eventOfferSchema,
    result: eventResultSchema.nullable(),
  }).strict().superRefine((room, context) => {
    if (room.result && room.result.audit.eventId !== room.offer.eventId) {
      context.addIssue({ code: "custom", message: "event result does not match offer" });
    }
    if (room.result && !room.offer.options.some((option) => option.optionId === room.result?.audit.optionId)) {
      context.addIssue({ code: "custom", message: "event result option was not offered" });
    }
  }),
]);

const guardianIds = new Set(seasonOne.guardians.map(({ id }) => id));
const invaderIds = new Set(seasonOne.invaders.map(({ id }) => id));
const season = loadSeason(seasonOne);
const dieIds = new Set(season.dice.map(({ id }) => id));
const legacyHeroIds = new Set(season.heroes.map(({ id }) => id));
const legacyEnemyIds = new Set(season.enemies.map(({ id }) => id));
const legacyClassStageIds = new Set(season.classStages.map(({ id }) => id));
const guardianIdSchema = persistedIdSchema.refine((value) => guardianIds.has(value));
const invaderIdSchema = persistedIdSchema.refine((value) => invaderIds.has(value));
const legacyHeroIdSchema = persistedIdSchema.refine((value) => legacyHeroIds.has(value));
const legacyEnemyIdSchema = persistedIdSchema.refine((value) => legacyEnemyIds.has(value));
const legacyClassStageIdSchema = persistedIdSchema.refine((value) => legacyClassStageIds.has(value));
const dieIdSchema = persistedIdSchema.refine((value) => dieIds.has(value));
const equipmentItemIdSchema = runItemIdSchema.refine((value) => RUN_ITEMS[value]?.kind === "passive");
const consumableItemIdSchema = runItemIdSchema.refine((value) => RUN_ITEMS[value]?.kind === "consumable");
const runPhaseSchema = z.enum([
  "map-reveal",
  "ready-to-roll",
  "rolled",
  "room-choice",
  "combat-rolling",
  "combat-intervention",
  "combat-resolving",
  "promotion",
  "reward",
  "event",
  "complete",
]);
const roomTypeSchema = z.enum(["combat", "elite", "treasure", "merchant", "event", "rest", "boss"]);
const randomChannelCursorsSchema = z.object({
  map: safeNonNegativeIntegerSchema,
  encounter: safeNonNegativeIntegerSchema,
  combat: safeNonNegativeIntegerSchema,
  reward: safeNonNegativeIntegerSchema,
  event: safeNonNegativeIntegerSchema,
}).strict();
const mapNodeSchema = z.object({
  id: persistedIdSchema,
  type: roomTypeSchema,
  nextNodeIds: z.array(persistedIdSchema).max(3),
}).strict();
const mapLayerSchema = z.object({
  index: z.number().int().min(1).max(10),
  nodes: z.array(mapNodeSchema).min(1).max(3),
}).strict();
const mapSchema = z.object({
  layers: z.array(mapLayerSchema).min(2).max(10),
  rngCursor: safeNonNegativeIntegerSchema,
}).strict().superRefine((map, context) => {
  const issue = () => context.addIssue({ code: "custom", message: "invalid run map" });
  const nodeIds = new Set<string>();
  map.layers.forEach((layer, layerOffset) => {
    if (layer.index !== layerOffset + 1) issue();
    if (layerOffset === map.layers.length - 1) {
      if (layer.nodes.length !== 1 || layer.nodes[0]?.type !== "boss" || layer.nodes[0].nextNodeIds.length !== 0) issue();
    } else if (layer.nodes.some((node) => node.type === "boss")) issue();
    for (const node of layer.nodes) {
      if (nodeIds.has(node.id)) issue();
      nodeIds.add(node.id);
    }
  });
  map.layers.slice(0, -1).forEach((layer, layerOffset) => {
    const nextIds = new Set(map.layers[layerOffset + 1]!.nodes.map((node) => node.id));
    for (const node of layer.nodes) {
      if (node.nextNodeIds.length === 0 || node.nextNodeIds.length > 3) issue();
      if (new Set(node.nextNodeIds).size !== node.nextNodeIds.length) issue();
      if (!node.nextNodeIds.every((id) => nextIds.has(id))) issue();
    }
  });
});
const equippedSlotsSchema = z.object({
  weapon: equipmentItemIdSchema.nullable(),
  armor: equipmentItemIdSchema.nullable(),
  accessory: equipmentItemIdSchema.nullable(),
}).strict();
const dieRollSchema = z.object({
  dieId: dieIdSchema,
  sides: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12), z.literal(20)]),
  result: z.number().int().min(1).max(20),
  locked: z.boolean(),
}).strict().superRefine((roll, context) => {
  if (roll.result > roll.sides) context.addIssue({ code: "custom", message: "roll result exceeds die sides" });
});
const combatDieResultSchema = z.object({
  kind: z.enum(["damage", "defense"]),
  sides: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
  faceIndex: safeNonNegativeIntegerSchema,
  label: z.string().min(1).max(100),
  value: safeNonNegativeIntegerSchema,
  healing: safeNonNegativeIntegerSchema,
}).strict();
const combatTurnSchema = z.object({
  turn: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  damage: combatDieResultSchema,
  defense: combatDieResultSchema,
  enemyAttack: z.object({
    sides: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12), z.literal(20)]),
    result: z.number().int().min(1).max(20),
  }).strict(),
  interventionEndsAt: safeNonNegativeIntegerSchema,
  rerolledDieKinds: z.array(z.enum(["damage", "defense"])).max(2),
}).strict().superRefine((turn, context) => {
  if (turn.enemyAttack.result > turn.enemyAttack.sides) context.addIssue({ code: "custom", message: "enemy roll exceeds die sides" });
  if (new Set(turn.rerolledDieKinds).size !== turn.rerolledDieKinds.length) context.addIssue({ code: "custom", message: "duplicate rerolled die kind" });
});
const rewardOfferSchema = z.object({
  options: z.array(z.object({ offerId: persistedIdSchema, dieId: dieIdSchema }).strict()).min(1).max(3),
  rngCursor: safeNonNegativeIntegerSchema,
}).strict();
const canonicalKeys = [
  "campaignPhaseIndex", "completedRoomCount", "outcome", "guardianId", "unlockedGuardianIds",
  "guardianHp", "guardianMaxHp", "guardianNaturalDefense", "invaderId", "invaderHp",
  "invaderMaxHp", "invaderNaturalDefense", "inventory", "consumables", "equipment",
] as const;
const canonicalStateSchema = z.object({
  sequence: safeNonNegativeIntegerSchema,
  map: mapSchema,
  rngCursors: randomChannelCursorsSchema,
  phase: runPhaseSchema,
  campaignPhaseIndex: z.number().int().min(1).max(7),
  completedRoomCount: safeNonNegativeIntegerSchema,
  outcome: z.enum(["ongoing", "victory", "defeat"]),
  guardianId: guardianIdSchema,
  unlockedGuardianIds: z.array(guardianIdSchema).min(1).max(5),
  guardianHp: safeNonNegativeIntegerSchema,
  guardianMaxHp: safeNonNegativeIntegerSchema,
  guardianNaturalDefense: safeNonNegativeIntegerSchema,
  invaderId: invaderIdSchema.nullable(),
  invaderHp: safeNonNegativeIntegerSchema,
  invaderMaxHp: safeNonNegativeIntegerSchema,
  invaderNaturalDefense: safeNonNegativeIntegerSchema,
  inventory: z.array(equipmentItemIdSchema),
  consumables: z.record(consumableItemIdSchema, z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
  equipment: z.record(guardianIdSchema, equippedSlotsSchema),
  heroId: legacyHeroIdSchema,
  heroHp: safeNonNegativeIntegerSchema,
  heroMaxHp: safeNonNegativeIntegerSchema,
  enemyId: legacyEnemyIdSchema,
  enemyHp: safeNonNegativeIntegerSchema,
  combatRound: safeNonNegativeIntegerSchema,
  combatTurn: combatTurnSchema.nullable(),
  essence: safeNonNegativeIntegerSchema,
  maxEssence: safeNonNegativeIntegerSchema,
  gold: safeNonNegativeIntegerSchema,
  pendingRoom: pendingRoomSchema,
  handledRoomCommandIds: z.array(persistedIdSchema).max(500),
  purchasedMerchantOfferIds: z.array(persistedIdSchema).max(500),
  hasInsurance: z.boolean(),
  equippedDieIds: z.array(dieIdSchema).min(1).max(12),
  rolls: z.array(dieRollSchema).max(12),
  visitedRoomIds: z.array(persistedIdSchema).max(100),
  currentLayer: safeNonNegativeIntegerSchema,
  availableRoomIds: z.array(persistedIdSchema).max(3),
  currentRoomId: persistedIdSchema.nullable(),
  currentClassStageId: legacyClassStageIdSchema,
  xp: safeNonNegativeIntegerSchema,
  pendingPromotionIds: z.array(legacyClassStageIdSchema).max(2),
  rewardOffer: rewardOfferSchema.nullable(),
  eventOffer: eventOfferSchema.nullable(),
  eventAuditTrail: z.array(eventAuditSchema).max(100),
}).strict().superRefine((state, context) => {
  const issue = () => context.addIssue({ code: "custom", message: "invalid run state" });
  const nodes = state.map.layers.flatMap((layer) => layer.nodes);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const firstLayerIds = new Set(state.map.layers[0]?.nodes.map((node) => node.id) ?? []);
  if (new Set(state.unlockedGuardianIds).size !== state.unlockedGuardianIds.length) issue();
  if (!state.unlockedGuardianIds.includes(state.guardianId)) issue();
  if (state.guardianHp > state.guardianMaxHp || state.guardianMaxHp === 0) issue();
  if (state.heroHp !== state.guardianHp || state.heroMaxHp !== state.guardianMaxHp) issue();
  if (state.outcome === "defeat" && (state.guardianHp !== 0 || state.phase !== "complete")) issue();
  if (state.outcome === "victory" && (state.guardianHp === 0 || state.phase !== "complete" || state.campaignPhaseIndex !== 7)) issue();
  if (state.outcome === "ongoing" && (state.guardianHp === 0 || state.phase === "complete")) issue();
  if (state.invaderId === null && (state.invaderHp !== 0 || state.invaderMaxHp !== 0 || state.invaderNaturalDefense !== 0)) issue();
  if (state.invaderId !== null && (state.invaderMaxHp === 0 || state.invaderHp > state.invaderMaxHp)) issue();
  if (state.invaderId !== null && (state.enemyHp !== state.invaderHp || (state.invaderId === "torch-bearer" ? state.enemyId !== "receipt-slime" : state.enemyId !== state.invaderId))) issue();
  if (new Set(state.inventory).size !== state.inventory.length) issue();
  if (state.essence > state.maxEssence || state.maxEssence === 0) issue();
  if (state.completedRoomCount !== state.visitedRoomIds.length) issue();
  if (state.currentLayer >= state.map.layers.length) issue();
  if (state.currentRoomId !== null && !nodeIds.has(state.currentRoomId)) issue();
  if (!state.visitedRoomIds.every((id) => nodeIds.has(id)) || new Set(state.visitedRoomIds).size !== state.visitedRoomIds.length) issue();
  if (!state.availableRoomIds.every((id) => nodeIds.has(id))) issue();
  if (state.currentRoomId === null && !state.availableRoomIds.every((id) => firstLayerIds.has(id))) issue();
  if (state.combatTurn === null && state.phase === "combat-intervention") issue();
  if (state.combatTurn !== null && state.phase !== "combat-intervention") issue();
  if (new Set(state.equippedDieIds).size !== state.equippedDieIds.length) issue();
  if (!state.rolls.every((roll) => state.equippedDieIds.includes(roll.dieId))) issue();
  if (new Set(state.handledRoomCommandIds).size !== state.handledRoomCommandIds.length) issue();
  if (new Set(state.purchasedMerchantOfferIds).size !== state.purchasedMerchantOfferIds.length) issue();
  if (Object.keys(state.equipment).length !== state.unlockedGuardianIds.length) issue();
  if (!state.unlockedGuardianIds.every((id) => Object.hasOwn(state.equipment, id))) issue();
  const equipped = new Set<string>();
  for (const slots of Object.values(state.equipment)) {
    for (const [slot, itemId] of Object.entries(slots)) {
      if (itemId === null) continue;
      if (!state.inventory.includes(itemId) || RUN_ITEMS[itemId].slot !== slot || equipped.has(itemId)) issue();
      equipped.add(itemId);
    }
  }
});

function migrateCanonicalState(stored: Record<string, unknown>): Record<string, unknown> {
  const presentCount = canonicalKeys.filter((key) => stored[key] !== undefined).length;
  if (presentCount !== 0 && presentCount !== canonicalKeys.length) throw new Error("stored run state is invalid");
  if (presentCount === canonicalKeys.length) return stored;
  const mapParse = mapSchema.safeParse(stored.map);
  if (!mapParse.success) throw new Error("stored run state is invalid");
  const firstLayerIds = mapParse.data.layers[0]!.nodes.map((node) => node.id);
  const arraysMatch = (candidate: unknown, expected: readonly string[]) =>
    Array.isArray(candidate) && candidate.length === expected.length && expected.every((value, index) => candidate[index] === value);
  const isPristineLegacyStarter =
    stored.sequence === 0 &&
    stored.heroId === "squire" &&
    stored.phase === "map-reveal" &&
    stored.heroHp === 24 &&
    stored.heroMaxHp === 24 &&
    stored.enemyId === "receipt-slime" &&
    stored.enemyHp === 9 &&
    stored.combatRound === 0 &&
    stored.combatTurn === null &&
    stored.currentLayer === 0 &&
    stored.currentRoomId === null &&
    arraysMatch(stored.availableRoomIds, firstLayerIds) &&
    arraysMatch(stored.visitedRoomIds, []) &&
    arraysMatch(stored.rolls, []) &&
    arraysMatch(stored.handledRoomCommandIds ?? [], []) &&
    arraysMatch(stored.purchasedMerchantOfferIds ?? [], []) &&
    stored.pendingRoom === null &&
    stored.rewardOffer === null &&
    stored.eventOffer === null &&
    arraysMatch(stored.eventAuditTrail, []);
  if (!isPristineLegacyStarter) {
    throw new Error("stored run state is invalid");
  }
  const guardian = seasonOne.guardians.find(({ id }) => id === "caretaker-slime")!;
  return {
    ...stored,
    campaignPhaseIndex: 1,
    completedRoomCount: 0,
    outcome: "ongoing",
    guardianId: guardian.id,
    unlockedGuardianIds: [guardian.id],
    guardianHp: guardian.maxHp,
    guardianMaxHp: guardian.maxHp,
    guardianNaturalDefense: guardian.naturalDefense,
    invaderId: "torch-bearer",
    invaderHp: 9,
    invaderMaxHp: 9,
    invaderNaturalDefense: 0,
    heroHp: guardian.maxHp,
    heroMaxHp: guardian.maxHp,
    inventory: Array.isArray(stored.inventory) ? stored.inventory : [],
    consumables: {},
    equipment: { [guardian.id]: { weapon: null, armor: null, accessory: null } },
    pendingRoom: null,
    handledRoomCommandIds: [],
    purchasedMerchantOfferIds: [],
  };
}

function withoutSeed(state: RunState): PersistedRunState {
  const persisted: MutablePartialRunState = { ...state };
  delete persisted.seed;
  return persisted as PersistedRunState;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parsePersistedState(value: Prisma.JsonValue): PersistedRunState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored run state is invalid");
  }
  const stored = migrateCanonicalState(value as Record<string, unknown>);
  const canonical = canonicalStateSchema.safeParse(stored);
  if (!canonical.success) throw new Error("stored run state is invalid");
  return canonical.data as unknown as PersistedRunState;
}

export function createRunService({ prisma, seedSecret }: Dependencies) {
  const seedCipher = createSeedCipher(seedSecret);

  async function findIdempotent(runId: string, idempotencyKey: string) {
    const existing = await prisma.runCommand.findUnique({
      where: { runId_idempotencyKey: { runId, idempotencyKey } },
    });
    return existing?.responseJson as unknown as RunResponse | undefined;
  }

  return {
    async start(ownerId: string, guardianId: string): Promise<RunResponse> {
      const seed = randomBytes(32).toString("base64url");
      const state = createRun({ seed, guardianId });
      const persisted = withoutSeed(state);
      const run = await prisma.run.create({
        data: {
          ownerId,
          engineVersion: "1.0.0",
          contentVersion: "1.0.0",
          sequence: state.sequence,
          seedCiphertext: seedCipher.encrypt(seed),
          stateJson: toJson(persisted),
        },
      });
      return { id: run.id, version: run.version, state: persisted };
    },

    async execute(
      ownerId: string,
      runId: string,
      idempotencyKey: string,
      command: RunCommand,
    ): Promise<RunResponse> {
      const prior = await findIdempotent(runId, idempotencyKey);
      if (prior) return prior;

      const run = await prisma.run.findFirst({ where: { id: runId, ownerId } });
      if (!run) throw new Error("run not found");

      const committedWhileLoading = await findIdempotent(runId, idempotencyKey);
      if (committedWhileLoading) return committedWhileLoading;

      const seed = seedCipher.decrypt(run.seedCiphertext);
      const currentState: RunState = { seed, ...parsePersistedState(run.stateJson) };
      const nextState = applyCommand(currentState, command);
      if (nextState === currentState) {
        return { id: run.id, version: run.version, state: withoutSeed(currentState) };
      }
      const persisted = withoutSeed(nextState);
      const response: RunResponse = { id: run.id, version: run.version + 1, state: persisted };

      try {
        await prisma.$transaction(async (transaction) => {
          const updated = await transaction.run.updateMany({
            where: { id: run.id, ownerId, version: run.version },
            data: {
              version: { increment: 1 },
              sequence: nextState.sequence,
              stateJson: toJson(persisted),
            },
          });
          if (updated.count !== 1) throw new Error("run version conflict");

          await transaction.runCommand.create({
            data: {
              runId,
              sequence: nextState.sequence,
              idempotencyKey,
              type: command.type,
              payloadJson: toJson(command),
              responseJson: toJson(response),
            },
          });
        });
        return response;
      } catch (error) {
        const concurrentResult = await findIdempotent(runId, idempotencyKey);
        if (concurrentResult) return concurrentResult;
        if (error instanceof Error && /run version conflict/i.test(error.message) && "commandId" in command) {
          const latestRun = await prisma.run.findFirst({ where: { id: runId, ownerId } });
          if (latestRun) {
            const latestSeed = seedCipher.decrypt(latestRun.seedCiphertext);
            const latestState: RunState = { seed: latestSeed, ...parsePersistedState(latestRun.stateJson) };
            if (latestState.handledRoomCommandIds.includes(command.commandId)) {
              return { id: latestRun.id, version: latestRun.version, state: withoutSeed(latestState) };
            }
          }
        }
        throw error;
      }
    },
  };
}

export type RunService = ReturnType<typeof createRunService>;
