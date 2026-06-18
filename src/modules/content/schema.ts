import { z } from "zod";

const idSchema = z.string().regex(/^[a-z0-9-]+$/).max(80);
const raritySchema = z.enum(["common", "rare", "epic", "legendary", "relic"]);

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
    unlock: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("starter") }).strict(),
      z.object({ kind: z.literal("achievement"), achievementId: idSchema }).strict(),
    ]),
  })
  .strict();

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
    dice: z.array(dieSchema).min(1),
    enemies: z.array(enemySchema).min(1),
    events: z.array(eventSchema).min(1),
  })
  .strict();

export type Die = z.infer<typeof dieSchema>;
export type Hero = z.infer<typeof heroSchema>;
export type Enemy = z.infer<typeof enemySchema>;
export type SeasonEvent = z.infer<typeof eventSchema>;
export type Season = z.infer<typeof seasonSchema>;
