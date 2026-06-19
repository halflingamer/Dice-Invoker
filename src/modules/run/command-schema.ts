import { z } from "zod";

const id = z.string().regex(/^[a-z0-9-]+$/).max(80);
const sequence = z.number().int().positive();

export const runCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ACKNOWLEDGE_MAP_REVEAL"), sequence }).strict(),
  z.object({ type: z.literal("CHOOSE_ROOM"), sequence, roomId: id }).strict(),
  z.object({ type: z.literal("BEGIN_COMBAT_TURN"), sequence }).strict(),
  z.object({
    type: z.literal("REROLL_COMBAT_DIE"),
    sequence,
    dieKind: z.enum(["damage", "defense"]),
  }).strict(),
  z.object({ type: z.literal("RESOLVE_COMBAT_TURN"), sequence }).strict(),
  z.object({ type: z.literal("ROLL_DICE"), sequence }).strict(),
  z.object({ type: z.literal("LOCK_RESULT"), sequence, dieId: id }).strict(),
  z
    .object({ type: z.literal("REROLL"), sequence, dieIds: z.array(id).min(1).max(12) })
    .strict(),
  z
    .object({
      type: z.literal("ACTIVATE_RESULTS"),
      sequence,
      dieIds: z.array(id).min(1).max(12),
    })
    .strict(),
  z.object({ type: z.literal("CHOOSE_REWARD"), sequence, rewardId: id }).strict(),
  z
    .object({ type: z.literal("CHOOSE_EVENT_OPTION"), sequence, optionId: id })
    .strict(),
  z.object({ type: z.literal("CHOOSE_PROMOTION"), sequence, classStageId: id }).strict(),
]);

export type RunCommand = z.infer<typeof runCommandSchema>;
