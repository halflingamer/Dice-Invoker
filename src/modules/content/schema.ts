import { z } from "zod";

const idSchema = z.string().regex(/^[a-z0-9-]+$/).max(80);
const raritySchema = z.enum(["common", "rare", "epic", "legendary", "relic"]);
export const combatDieSidesSchema = z.union([
  z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12), z.literal(20),
]);

export const effectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("damage"), amount: z.number().int().positive().max(99) }).strict(),
  z.object({ kind: z.literal("block"), amount: z.number().int().positive().max(99) }).strict(),
  z.object({ kind: z.literal("heal"), amount: z.number().int().positive().max(99) }).strict(),
]);

export const dieSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(80),
  type: z.enum(["attack", "defense", "magic"]),
  rarity: raritySchema,
  sides: combatDieSidesSchema,
  faces: z.array(z.object({ id: idSchema, label: z.string().min(1).max(80), effect: effectSchema }).strict()),
}).strict().superRefine((die, ctx) => {
  if (die.faces.length !== die.sides) ctx.addIssue({ code: "custom", message: "faces must equal sides" });
});

const unlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("starter") }).strict(),
  z.object({ kind: z.literal("achievement"), achievementId: idSchema }).strict(),
]);

export const guardianSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(80),
  rarity: raritySchema,
  maxHp: z.number().int().positive().max(999),
  naturalDefense: z.number().int().nonnegative().max(99),
  startingDiceIds: z.array(idSchema).min(1).max(6),
  rootEvolutionStageId: idSchema,
  unlock: unlockSchema,
}).strict();

export const evolutionStageSchema = z.object({
  id: idSchema,
  guardianId: idSchema,
  name: z.string().min(1).max(80),
  sides: combatDieSidesSchema,
  naturalDefense: z.number().int().nonnegative().max(99),
  xpThreshold: z.number().int().nonnegative().max(100_000),
  role: z.enum(["balanced", "assault", "defense"]),
  nextStageIds: z.array(idSchema).refine((ids) => ids.length === 0 || ids.length === 2, {
    message: "evolution stages must have zero or two next stages",
  }),
}).strict();

export const invaderSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(80),
  rank: z.enum(["common", "elite", "boss"]),
  maxHp: z.number().int().positive().max(9999),
  naturalDefense: z.number().int().nonnegative().max(999),
  attackDie: combatDieSidesSchema,
}).strict();

export const dungeonPhaseSchema = z.object({
  id: idSchema,
  index: z.number().int().min(1).max(7),
  name: z.string().min(1).max(100),
  roomCount: z.number().int().min(3).max(9),
  difficulty: z.number().int().min(1).max(7),
  bossInvaderId: idSchema,
}).strict();

export const eventSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  options: z.array(z.object({
    id: idSchema,
    label: z.string().min(1).max(100),
    consequence: z.enum(["reward", "safe", "risk"]),
  }).strict()).min(2).max(3),
}).strict();

const seasonSourceSchema = z.object({
  id: idSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: z.string().min(1).max(120),
  guardians: z.array(guardianSchema).min(1),
  evolutionStages: z.array(evolutionStageSchema).min(1),
  dice: z.array(dieSchema).min(1),
  invaders: z.array(invaderSchema).min(1),
  events: z.array(eventSchema).min(1),
  phases: z.array(dungeonPhaseSchema).length(7),
}).strict();

// Deprecated runtime views keep pre-migration consumers compiling without duplicating source content.
export const seasonSchema = seasonSourceSchema.transform((season) => {
  const guardianLegacyIds: Readonly<Record<string, string>> = {
    "caretaker-slime": "squire",
  };
  const stageLegacyIds: Readonly<Record<string, string>> = {
    "caretaker-slime-d4": "squire-d4",
    "caretaker-slime-d6-1": "warrior-d6", "caretaker-slime-d6-2": "guardian-d6",
    "caretaker-slime-d8-1": "duelist-d8", "caretaker-slime-d8-2": "knight-d8",
    "caretaker-slime-d8-3": "paladin-d8", "caretaker-slime-d8-4": "bastion-d8",
    "caretaker-slime-d10-1": "blade-dancer-d10", "caretaker-slime-d10-2": "riposte-master-d10",
    "caretaker-slime-d10-3": "royal-lancer-d10", "caretaker-slime-d10-4": "iron-marshal-d10",
    "caretaker-slime-d10-5": "sun-templar-d10", "caretaker-slime-d10-6": "oathkeeper-d10",
    "caretaker-slime-d10-7": "fortress-d10", "caretaker-slime-d10-8": "thorn-warden-d10",
    "caretaker-slime-d12-1": "storm-of-steel-d12", "caretaker-slime-d12-2": "fate-duelist-d12",
    "caretaker-slime-d12-3": "perfect-counter-d12", "caretaker-slime-d12-4": "mirror-blade-d12",
    "caretaker-slime-d12-5": "dragon-lancer-d12", "caretaker-slime-d12-6": "kings-vanguard-d12",
    "caretaker-slime-d12-7": "adamant-general-d12", "caretaker-slime-d12-8": "war-citadel-d12",
    "caretaker-slime-d12-9": "solar-paragon-d12", "caretaker-slime-d12-10": "dawn-saint-d12",
    "caretaker-slime-d12-11": "eternal-oath-d12", "caretaker-slime-d12-12": "mercy-crown-d12",
    "caretaker-slime-d12-13": "living-fortress-d12", "caretaker-slime-d12-14": "world-shield-d12",
    "caretaker-slime-d12-15": "iron-thorns-d12", "caretaker-slime-d12-16": "retribution-king-d12",
  };
  const invaderLegacyIds: Readonly<Record<string, string>> = { "torch-bearer": "receipt-slime" };
  const guardianLegacyId = (id: string) => guardianLegacyIds[id] ?? id;
  const stageLegacyId = (id: string) => stageLegacyIds[id] ?? id;
  const invaderLegacyId = (id: string) => invaderLegacyIds[id] ?? id;
  const assertUniqueAliases = (label: string, ids: readonly string[]) => {
    if (new Set(ids).size !== ids.length) throw new Error(`duplicate compatibility ${label} id`);
  };
  const compatibleStages = season.evolutionStages.filter(
    (stage): stage is typeof stage & { sides: 4 | 6 | 8 | 10 | 12 } => stage.sides !== 20,
  );
  assertUniqueAliases("guardian", season.guardians.map(({ id }) => guardianLegacyId(id)));
  assertUniqueAliases("class stage", compatibleStages.map(({ id }) => stageLegacyId(id)));
  assertUniqueAliases("enemy", season.invaders.map(({ id }) => invaderLegacyId(id)));

  return {
  ...season,
  heroes: season.guardians.map((guardian) => ({
    id: guardianLegacyId(guardian.id),
    name: guardian.id === "caretaker-slime" ? "Escudeiro" : guardian.name,
    class: "guardian" as const,
    rarity: guardian.rarity,
    maxHp: guardian.id === "caretaker-slime" ? 24 : guardian.maxHp,
    startingDiceIds: guardian.id === "caretaker-slime"
      ? ["rusty-sword", "wooden-shield"]
      : guardian.startingDiceIds,
    rootClassStageId: stageLegacyId(guardian.rootEvolutionStageId),
    unlock: guardian.unlock,
  })),
  classStages: compatibleStages
    .map((stage) => ({
    id: stageLegacyId(stage.id),
    heroId: guardianLegacyId(stage.guardianId),
    name: stage.name,
    sides: stage.sides,
    xpThreshold: stage.xpThreshold,
    role: stage.role,
    nextStageIds: stage.nextStageIds
      .filter((id) => season.evolutionStages.find((candidate) => candidate.id === id)?.sides !== 20)
      .map(stageLegacyId),
    aiWeights: stage.role === "assault" ? { attack: 75, defense: 20, magic: 5 }
      : stage.role === "defense" ? { attack: 25, defense: 70, magic: 5 }
      : { attack: 45, defense: 45, magic: 10 },
    faces: Array.from({ length: stage.sides }, (_, index) => ({
      id: `${stageLegacyId(stage.id)}-face-${index + 1}`,
      label: `${stage.name} ${index + 1}`,
      damage: Math.floor(index / 2) + 1,
      block: Math.floor(index / 2) + 1 + stage.naturalDefense,
      healing: 0,
    })),
    })),
  enemies: season.invaders.map((invader) => ({
    id: invaderLegacyId(invader.id),
    name: invader.name,
    rank: invader.rank,
    maxHp: invader.maxHp,
    damage: Math.max(1, Math.floor(invader.attackDie / 2)),
  })),
  };
});

export type Die = z.infer<typeof dieSchema>;
export type Guardian = z.infer<typeof guardianSchema>;
export type EvolutionStage = z.infer<typeof evolutionStageSchema>;
export type Invader = z.infer<typeof invaderSchema>;
export type DungeonPhase = z.infer<typeof dungeonPhaseSchema>;
export type SeasonEvent = z.infer<typeof eventSchema>;
export type SeasonSource = z.input<typeof seasonSchema>;
export type Season = z.output<typeof seasonSchema>;
/** @deprecated Use Guardian. */
export type Hero = Season["heroes"][number];
/** @deprecated Use EvolutionStage. */
export type ClassStage = Season["classStages"][number];
/** @deprecated Use Invader. */
export type Enemy = Season["enemies"][number];
