import { describe, expect, it } from "vitest";
import { createMerchantOffer, createTreasureOffer } from "./rewards";
import { createNamedRollStream, createRollStream } from "./rng";

const roomItemIds = [
  "sharp-sword",
  "reinforced-shield",
  "healing-potion",
  "tax-amulet",
] as const;

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

  it("does not let merchant and treasure offers alter active map or combat streams", () => {
    const expectedMap = createNamedRollStream("room-seed", "map", 3);
    const actualMap = createNamedRollStream("room-seed", "map", 3);
    const expectedCombat = createNamedRollStream("room-seed", "combat", 7);
    const actualCombat = createNamedRollStream("room-seed", "combat", 7);

    expect(actualMap.roll(20)).toBe(expectedMap.roll(20));
    expect(actualCombat.roll(12)).toBe(expectedCombat.roll(12));

    const merchant = createMerchantOffer("room-seed", 0, roomItemIds);
    createTreasureOffer("room-seed", merchant.rngCursor, roomItemIds);

    expect(Array.from({ length: 6 }, () => actualMap.roll(100))).toEqual(
      Array.from({ length: 6 }, () => expectedMap.roll(100)),
    );
    expect(Array.from({ length: 6 }, () => actualCombat.roll(20))).toEqual(
      Array.from({ length: 6 }, () => expectedCombat.roll(20)),
    );
    expect(actualMap.cursor()).toBe(expectedMap.cursor());
    expect(actualCombat.cursor()).toBe(expectedCombat.cursor());
  });

  it("rejects unknown random channels at runtime", () => {
    expect(() => createNamedRollStream("run-seed", "" as "map")).toThrow(/channel/i);
    expect(() => createNamedRollStream("run-seed", "forged" as "map")).toThrow(/channel/i);
  });
});
