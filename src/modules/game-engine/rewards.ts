import { createRollStream } from "./rng";

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

  const stream = createRollStream(seed, initialCursor);
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
