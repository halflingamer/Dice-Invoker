import { describe, expect, it } from "vitest";
import { createNamedRollStream, createRollStream } from "./rng";

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

describe("createNamedRollStream", () => {
  it("keeps deterministic random channels independent", () => {
    const firstMap = createNamedRollStream("run-seed", "map");
    const secondMap = createNamedRollStream("run-seed", "map");
    const combat = createNamedRollStream("run-seed", "combat");

    const firstMapResults = Array.from({ length: 8 }, () => firstMap.roll(20));
    const secondMapResults = Array.from({ length: 8 }, () => secondMap.roll(20));
    const combatResults = Array.from({ length: 8 }, () => combat.roll(20));

    expect(firstMapResults).toEqual(secondMapResults);
    expect(combatResults).not.toEqual(firstMapResults);
  });

  it("does not let combat rolls advance the map stream", () => {
    const expectedMap = createNamedRollStream("run-seed", "map");
    const combat = createNamedRollStream("run-seed", "combat");
    Array.from({ length: 20 }, () => combat.roll(12));

    const actualMap = createNamedRollStream("run-seed", "map");

    expect(actualMap.roll(100)).toBe(expectedMap.roll(100));
    expect(actualMap.cursor()).toBe(expectedMap.cursor());
  });

  it("rejects unknown random channels at runtime", () => {
    expect(() => createNamedRollStream("run-seed", "" as "map")).toThrow(/channel/i);
    expect(() => createNamedRollStream("run-seed", "forged" as "map")).toThrow(/channel/i);
  });
});
