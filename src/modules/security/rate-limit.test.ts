import { describe, expect, it } from "vitest";
import { runCommandRateLimitKey, runCommandRateLimitPolicy } from "./rate-limit";

describe("run command rate limit policy", () => {
  it("isolates purchase and room-choice commands into dedicated buckets", () => {
    expect(runCommandRateLimitPolicy("BUY_MERCHANT_ITEM")).toEqual({
      bucket: "buy-merchant-item",
      limit: 20,
      windowMs: 60_000,
    });
    expect(runCommandRateLimitPolicy("CHOOSE_TREASURE")).toEqual({
      bucket: "choose-treasure",
      limit: 12,
      windowMs: 60_000,
    });
    expect(runCommandRateLimitPolicy("CHOOSE_EVENT_OPTION")).toEqual({
      bucket: "choose-event-option",
      limit: 12,
      windowMs: 60_000,
    });
  });

  it("allows the automatic combat loop without sharing the player-intent bucket", () => {
    expect(runCommandRateLimitPolicy("BEGIN_COMBAT_TURN").bucket).toBe("automatic-combat");
    expect(runCommandRateLimitPolicy("BEGIN_COMBAT_TURN").limit).toBe(60);
  });

  it("isolates the same run id between authenticated accounts", () => {
    expect(runCommandRateLimitKey("user-a", "run-1", "choose-treasure"))
      .not.toBe(runCommandRateLimitKey("user-b", "run-1", "choose-treasure"));
  });
});
