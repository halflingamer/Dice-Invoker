import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
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
const guardianIdSchema = persistedIdSchema.refine((value) => guardianIds.has(value));
const invaderIdSchema = persistedIdSchema.refine((value) => invaderIds.has(value));
const equipmentItemIdSchema = runItemIdSchema.refine((value) => RUN_ITEMS[value].kind === "passive");
const consumableItemIdSchema = runItemIdSchema.refine((value) => RUN_ITEMS[value].kind === "consumable");
const equippedSlotsSchema = z.object({
  weapon: equipmentItemIdSchema.nullable(),
  armor: equipmentItemIdSchema.nullable(),
  accessory: equipmentItemIdSchema.nullable(),
}).strict();
const canonicalKeys = [
  "campaignPhaseIndex", "completedRoomCount", "outcome", "guardianId", "unlockedGuardianIds",
  "guardianHp", "guardianMaxHp", "guardianNaturalDefense", "invaderId", "invaderHp",
  "invaderMaxHp", "invaderNaturalDefense", "consumables", "equipment",
] as const;
const canonicalStateSchema = z.object({
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
  phase: z.string(),
  heroHp: safeNonNegativeIntegerSchema,
  heroMaxHp: safeNonNegativeIntegerSchema,
  enemyId: persistedIdSchema,
  enemyHp: safeNonNegativeIntegerSchema,
}).passthrough().superRefine((state, context) => {
  const issue = () => context.addIssue({ code: "custom", message: "invalid run state" });
  if (new Set(state.unlockedGuardianIds).size !== state.unlockedGuardianIds.length) issue();
  if (!state.unlockedGuardianIds.includes(state.guardianId)) issue();
  if (state.guardianHp > state.guardianMaxHp || state.guardianMaxHp === 0) issue();
  if (state.heroHp !== state.guardianHp || state.heroMaxHp !== state.guardianMaxHp) issue();
  if (state.outcome === "defeat" ? state.guardianHp !== 0 : state.guardianHp === 0) issue();
  if (state.outcome === "victory" && state.phase !== "complete") issue();
  if (state.outcome !== "victory" && state.phase === "complete") issue();
  if (state.invaderId === null && (state.invaderHp !== 0 || state.invaderMaxHp !== 0 || state.invaderNaturalDefense !== 0)) issue();
  if (state.invaderId !== null && (state.invaderMaxHp === 0 || state.invaderHp > state.invaderMaxHp)) issue();
  if (state.invaderId !== null && (state.enemyHp !== state.invaderHp || (state.invaderId === "torch-bearer" ? state.enemyId !== "receipt-slime" : state.enemyId !== state.invaderId))) issue();
  if (new Set(state.inventory).size !== state.inventory.length) issue();
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
  if (stored.heroId !== "squire" || stored.phase !== "map-reveal" || stored.heroHp !== 24 || stored.heroMaxHp !== 24) {
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
    consumables: {},
    equipment: { [guardian.id]: { weapon: null, armor: null, accessory: null } },
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
  const parseField = <Output>(schema: z.ZodType<Output>, candidate: unknown, fallback: Output): Output => {
    const parsed = schema.safeParse(candidate === undefined ? fallback : candidate);
    if (!parsed.success) throw new Error("stored run state is invalid");
    return parsed.data;
  };
  const inventory = parseField(z.array(runItemIdSchema), stored.inventory, []);
  const handledRoomCommandIds = parseField(z.array(persistedIdSchema), stored.handledRoomCommandIds, []);
  const purchasedMerchantOfferIds = parseField(z.array(persistedIdSchema), stored.purchasedMerchantOfferIds, []);
  const pendingRoom = pendingRoomSchema.safeParse(stored.pendingRoom === undefined ? null : stored.pendingRoom);
  if (!pendingRoom.success) {
    throw new Error("stored run state is invalid");
  }
  const canonical = canonicalStateSchema.safeParse({ ...stored, inventory });
  if (!canonical.success) throw new Error("stored run state is invalid");
  return {
    ...stored,
    inventory,
    pendingRoom: pendingRoom.data,
    handledRoomCommandIds,
    purchasedMerchantOfferIds,
  } as unknown as PersistedRunState;
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
    async start(ownerId: string, heroId: string): Promise<RunResponse> {
      const seed = randomBytes(32).toString("base64url");
      const state = createRun({ seed, heroId });
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
