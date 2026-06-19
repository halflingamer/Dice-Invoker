import { createHmac } from "node:crypto";

export type RollStream = {
  roll(sides: number): number;
  cursor(): number;
};

export type RandomChannel = "map" | "encounter" | "combat" | "reward" | "event";

const UINT32_RANGE = 0x1_0000_0000;
const RANDOM_CHANNELS = new Set<RandomChannel>([
  "map",
  "encounter",
  "combat",
  "reward",
  "event",
]);

export function createNamedRollStream(
  seed: string,
  channel: RandomChannel,
  initialCursor = 0,
): RollStream {
  if (seed.length === 0) throw new Error("seed must not be empty");
  if (!RANDOM_CHANNELS.has(channel)) throw new Error("unknown random channel");
  const channelSeed = createHmac("sha256", seed)
    .update(`dice-invoker/random-channel/v1/${channel}`)
    .digest("hex");
  return createRollStream(channelSeed, initialCursor);
}

export function createRollStream(seed: string, initialCursor = 0): RollStream {
  if (seed.length === 0) throw new Error("seed must not be empty");
  if (!Number.isSafeInteger(initialCursor) || initialCursor < 0) {
    throw new Error("cursor must be a non-negative safe integer");
  }

  let currentCursor = initialCursor;

  return {
    roll(sides: number) {
      if (!Number.isSafeInteger(sides) || sides < 2 || sides > 100) {
        throw new Error("sides must be an integer between 2 and 100");
      }

      const unbiasedLimit = Math.floor(UINT32_RANGE / sides) * sides;

      while (true) {
        const digest = createHmac("sha256", seed).update(String(currentCursor)).digest();
        currentCursor += 1;
        const value = digest.readUInt32BE(0);
        if (value < unbiasedLimit) return (value % sides) + 1;
      }
    },
    cursor() {
      return currentCursor;
    },
  };
}
