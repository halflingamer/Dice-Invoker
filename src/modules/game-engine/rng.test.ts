import { describe, expect, it } from "vitest";
import { createRollStream } from "./rng";

describe("createRollStream", () => {
  it("repeats a sequence for the same seed and cursor", () => {
    const first = createRollStream("season-secret", 0);
    const second = createRollStream("season-secret", 0);

    expect([first.roll(6), first.roll(6), first.roll(8)]).toEqual([
      second.roll(6),
      second.roll(6),
      second.roll(8),
    ]);
  });

  it("keeps every result inside die bounds", () => {
    const stream = createRollStream("bounds-secret", 0);

    for (let index = 0; index < 1_000; index += 1) {
      const result = stream.roll(6);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    }
  });

  it("rejects invalid side counts", () => {
    const stream = createRollStream("invalid-die", 0);
    expect(() => stream.roll(1)).toThrow(/sides/i);
  });
});
