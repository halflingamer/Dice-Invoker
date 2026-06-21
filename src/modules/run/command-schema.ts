import { z } from "zod";

const id = z.string().regex(/^[a-z0-9-]+$/).max(80);
const sequence = z.number().int().positive();

export const runCommandSchema = z.union([
  z.object({ type: z.literal("ACKNOWLEDGE_MAP_REVEAL"), sequence }).strict(),
  z.object({ type: z.literal("CHOOSE_ROOM"), sequence, roomId: id }).strict(),
  z.object({ type: z.literal("BEGIN_COMBAT_TURN"), sequence }).strict(),
  z.object({
    type: z.literal("REROLL_COMBAT_DIE"),
    sequence,
    dieKind: z.literal("damage"),
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
  z.object({ type: z.literal("BUY_MERCHANT_ITEM"), offerId: id, commandId: id }).strict(),
  z.object({ type: z.literal("LEAVE_MERCHANT"), commandId: id }).strict(),
  z.object({ type: z.literal("CHOOSE_TREASURE"), offerId: id, commandId: id }).strict(),
  z.object({ type: z.literal("CHOOSE_EVENT_OPTION"), offerId: id, commandId: id }).strict(),
  z.object({ type: z.literal("ACKNOWLEDGE_EVENT_RESULT"), commandId: id }).strict(),
  z.object({ type: z.literal("CHOOSE_PROMOTION"), sequence, classStageId: id }).strict(),
  z.object({ type: z.literal("EQUIP_ITEM"), sequence, commandId: id, guardianId: id, itemId: id }).strict(),
  z.object({ type: z.literal("UNEQUIP_ITEM"), sequence, commandId: id, guardianId: id, slot: z.enum(["weapon", "armor", "accessory"]) }).strict(),
  z.object({ type: z.literal("USE_CONSUMABLE"), sequence, commandId: id, guardianId: id, itemId: id }).strict(),
  z.object({ type: z.literal("START_NEW_RUN"), sequence, commandId: id }).strict(),
]);

export type RunCommand = z.infer<typeof runCommandSchema>;
