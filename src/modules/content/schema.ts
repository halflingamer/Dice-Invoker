import { z } from "zod";

const idSchema = z.string().regex(/^[a-z0-9-]+$/).max(80);
const raritySchema = z.enum(["common", "rare", "epic", "legendary", "relic"]);
const classDieSidesSchema = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(8),
  z.literal(10),
  z.literal(12),
]);

export const effectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("damage"), amount: z.number().int().positive().max(99) }).strict(),
  z.object({ kind: z.literal("block"), amount: z.number().int().positive().max(99) }).strict(),
  z.object({ kind: z.literal("heal"), amount: z.number().int().positive().max(99) }).strict(),
]);

export const dieSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(80),
    type: z.enum(["attack", "defense", "magic"]),
    rarity: raritySchema,
    sides: z.number().int().min(4).max(20),
    faces: z.array(
      z.object({ id: idSchema, label: z.string().min(1).max(80), effect: effectSchema }).strict(),
    ),
  })
  .strict()
  .superRefine((die, ctx) => {
    if (die.faces.length !== die.sides) {
      ctx.addIssue({ code: "custom", message: "faces must equal sides" });
    }
  });

export const heroSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(80),
    class: z.enum(["guardian", "ranger", "mage"]),
    rarity: raritySchema,
    maxHp: z.number().int().positive().max(999),
    startingDiceIds: z.array(idSchema).min(1).max(6),
    rootClassStageId: idSchema.optional(),
    unlock: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("starter") }).strict(),
      z.object({ kind: z.literal("achievement"), achievementId: idSchema }).strict(),
    ]),
  })
  .strict();

export const classStageSchema = z
  .object({
    id: idSchema,
    heroId: idSchema,
    name: z.string().min(1).max(80),
    sides: classDieSidesSchema,
    xpThreshold: z.number().int().nonnegative().max(100_000),
    role: z.enum(["balanced", "assault", "defense", "counter", "support"]),
    aiWeights: z.object({
      attack: z.number().int().nonnegative().max(100),
      defense: z.number().int().nonnegative().max(100),
      magic: z.number().int().nonnegative().max(100),
    }).strict(),
    faces: z.array(z.object({
      id: idSchema,
      label: z.string().min(1).max(80),
      damage: z.number().int().nonnegative().max(99),
      block: z.number().int().nonnegative().max(99),
      healing: z.number().int().nonnegative().max(99),
    }).strict()),
    nextStageIds: z.array(idSchema).refine((ids) => ids.length === 0 || ids.length === 2, {
      message: "class stages must have zero or two next stages",
    }),
  })
  .strict()
  .superRefine((stage, ctx) => {
    if (stage.faces.length !== stage.sides) {
      ctx.addIssue({ code: "custom", message: "class stage faces must equal sides" });
    }
    if (stage.faces.some((face) => face.damage + face.block + face.healing === 0)) {
      ctx.addIssue({ code: "custom", message: "class stage faces must have an effect" });
    }
    if (stage.aiWeights.attack + stage.aiWeights.defense + stage.aiWeights.magic === 0) {
      ctx.addIssue({ code: "custom", message: "class stage AI weights must not all be zero" });
    }
  });

export const enemySchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(80),
    rank: z.enum(["common", "elite", "boss"]),
    maxHp: z.number().int().positive().max(9999),
    damage: z.number().int().positive().max(999),
  })
  .strict();

export const eventSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    options: z
      .array(
        z
          .object({
            id: idSchema,
            label: z.string().min(1).max(100),
            consequence: z.enum(["reward", "safe", "risk"]),
          })
          .strict(),
      )
      .min(2)
      .max(3),
  })
  .strict();

export const seasonSchema = z
  .object({
    id: idSchema,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    name: z.string().min(1).max(120),
    heroes: z.array(heroSchema).min(1),
    classStages: z.array(classStageSchema).min(1),
    dice: z.array(dieSchema).min(1),
    enemies: z.array(enemySchema).min(1),
    events: z.array(eventSchema).min(1),
  })
  .strict();

export type Die = z.infer<typeof dieSchema>;
export type Hero = z.infer<typeof heroSchema>;
export type ClassStage = z.infer<typeof classStageSchema>;
export type Enemy = z.infer<typeof enemySchema>;
export type SeasonEvent = z.infer<typeof eventSchema>;
export type Season = z.infer<typeof seasonSchema>;
