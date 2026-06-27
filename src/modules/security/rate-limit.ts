import type { RunCommand } from "@/modules/run/command-schema";

type Bucket = { count: number; resetsAt: number };

export type RateLimiter = Readonly<{
  consume(key: string, limit: number, windowMs: number, now?: number): boolean;
}>;

export type RunCommandRateLimitPolicy = Readonly<{
  bucket: string;
  limit: number;
  windowMs: number;
}>;

const ROOM_COMMAND_LIMITS: Partial<Record<RunCommand["type"], number>> = {
  BUY_MERCHANT_ITEM: 20,
  LEAVE_MERCHANT: 12,
  CHOOSE_TREASURE: 12,
  CHOOSE_EVENT_OPTION: 12,
  ACKNOWLEDGE_EVENT_RESULT: 12,
};

const INVENTORY_COMMANDS = new Set<RunCommand["type"]>([
  "EQUIP_ITEM",
  "UNEQUIP_ITEM",
  "USE_CONSUMABLE",
]);

export function runCommandRateLimitPolicy(
  commandType: RunCommand["type"],
): RunCommandRateLimitPolicy {
  if (commandType === "BEGIN_COMBAT_TURN" || commandType === "RESOLVE_COMBAT_TURN") {
    return { bucket: "automatic-combat", limit: 60, windowMs: 60_000 };
  }
  if (INVENTORY_COMMANDS.has(commandType)) {
    return { bucket: "inventory", limit: 30, windowMs: 60_000 };
  }
  if (commandType === "START_NEW_RUN") {
    return { bucket: "new-run", limit: 5, windowMs: 60_000 };
  }
  const roomLimit = ROOM_COMMAND_LIMITS[commandType];
  if (roomLimit) {
    return {
      bucket: commandType.toLowerCase().replaceAll("_", "-"),
      limit: roomLimit,
      windowMs: 60_000,
    };
  }
  return { bucket: "player-intent", limit: 30, windowMs: 60_000 };
}

export function runCommandRateLimitKey(
  userId: string,
  runId: string,
  bucket: string,
): string {
  return JSON.stringify(["run", userId, runId, bucket]);
}

export function createMemoryRateLimiter(): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    consume(key, limit, windowMs, now = Date.now()) {
      const current = buckets.get(key);
      if (!current || current.resetsAt <= now) {
        buckets.set(key, { count: 1, resetsAt: now + windowMs });
        return true;
      }
      if (current.count >= limit) return false;
      current.count += 1;
      return true;
    },
  };
}
