import { createNamedRollStream } from "./rng";
import { RUN_ITEMS, type RunItemId } from "./economy";

export type MerchantOption = Readonly<{
  offerId: string;
  itemId: RunItemId;
}>;

export type MerchantOffer = Readonly<{
  options: readonly [MerchantOption, MerchantOption, MerchantOption];
  rngCursor: number;
}>;

export type TreasurePayload =
  | Readonly<{ kind: "gold"; amount: number }>
  | Readonly<{ kind: "item"; itemId: RunItemId }>
  | Readonly<{ kind: "essence"; amount: number }>;

export type TreasureOption = Readonly<{
  offerId: string;
  payload: TreasurePayload;
}>;

export type TreasureOffer = Readonly<{
  options: readonly [TreasureOption, TreasureOption, TreasureOption];
  rngCursor: number;
}>;

function validatedItemIds(candidateItemIds: readonly string[]): RunItemId[] {
  if (!candidateItemIds.every((itemId): itemId is RunItemId => Object.hasOwn(RUN_ITEMS, itemId))) {
    throw new Error("invalid item id");
  }
  return [...new Set(candidateItemIds)];
}

export function createMerchantOffer(
  seed: string,
  initialCursor: number,
  candidateItemIds: readonly string[],
): MerchantOffer {
  const candidates = validatedItemIds(candidateItemIds);
  if (candidates.length < 3) throw new Error("at least three unique item candidates are required");

  const stream = createNamedRollStream(seed, "reward", initialCursor);
  const selectOption = (index: number): MerchantOption => {
    const selectedIndex = candidates.length === 1 ? 0 : stream.roll(candidates.length) - 1;
    const [itemId] = candidates.splice(selectedIndex, 1);
    if (!itemId) throw new Error("item candidate is missing");
    return { offerId: `merchant-${initialCursor}-${index + 1}-${stream.roll(100)}`, itemId };
  };
  const options: [MerchantOption, MerchantOption, MerchantOption] = [
    selectOption(0),
    selectOption(1),
    selectOption(2),
  ];

  return { options, rngCursor: stream.cursor() };
}

export function chooseMerchantItem(offer: MerchantOffer, offerId: string): MerchantOption {
  const option = offer.options.find((candidate) => candidate.offerId === offerId);
  if (!option) throw new Error("merchant item was not offered");
  return option;
}

export function createTreasureOffer(
  seed: string,
  initialCursor: number,
  candidateItemIds: readonly string[],
): TreasureOffer {
  const candidates = validatedItemIds(candidateItemIds);
  if (candidates.length === 0) throw new Error("at least one item candidate is required");

  const stream = createNamedRollStream(seed, "reward", initialCursor);
  const goldAmount = stream.roll(7) + 5;
  const itemId = candidates.length === 1
    ? candidates[0]!
    : candidates[stream.roll(candidates.length) - 1]!;
  const option = (index: number, payload: TreasurePayload): TreasureOption => ({
    offerId: `treasure-${initialCursor}-${index + 1}-${stream.roll(100)}`,
    payload,
  });
  const options: [TreasureOption, TreasureOption, TreasureOption] = [
    option(0, { kind: "gold", amount: goldAmount }),
    option(1, { kind: "item", itemId }),
    option(2, { kind: "essence", amount: 1 }),
  ];

  return { options, rngCursor: stream.cursor() };
}

export function chooseTreasureReward(offer: TreasureOffer, offerId: string): TreasureOption {
  const option = offer.options.find((candidate) => candidate.offerId === offerId);
  if (!option) throw new Error("treasure reward was not offered");
  return option;
}

export type RewardOption = Readonly<{
  offerId: string;
  dieId: string;
}>;

export type RewardOffer = Readonly<{
  options: readonly RewardOption[];
  rngCursor: number;
}>;

export function createRewardOffer(seed: string, initialCursor: number, candidateDieIds: readonly string[]): RewardOffer {
  const candidates = [...new Set(candidateDieIds)];
  if (candidates.length < 3) throw new Error("at least three unique reward candidates are required");

  const stream = createNamedRollStream(seed, "reward", initialCursor);
  const options = Array.from({ length: 3 }, (_, index): RewardOption => {
    const selectedIndex = stream.roll(candidates.length) - 1;
    const [dieId] = candidates.splice(selectedIndex, 1);
    if (!dieId) throw new Error("reward candidate is missing");
    return { offerId: `reward-${index + 1}-${stream.roll(100)}`, dieId };
  });

  return { options, rngCursor: stream.cursor() };
}

export function chooseReward(offer: RewardOffer, offerId: string): RewardOption {
  const reward = offer.options.find((option) => option.offerId === offerId);
  if (!reward) throw new Error("reward was not offered");
  return reward;
}
