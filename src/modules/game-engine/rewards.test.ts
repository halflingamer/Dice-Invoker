import { describe, expect, it } from "vitest";
import { createNamedRollStream } from "./rng";
import {
  chooseMerchantItem,
  chooseTreasureReward,
  createMerchantOffer,
  createTreasureOffer,
} from "./rewards";

const itemIds = [
  "sharp-sword",
  "reinforced-shield",
  "healing-potion",
  "tax-amulet",
] as const;

describe("createMerchantOffer", () => {
  it("creates three unique controlled item options", () => {
    const offer = createMerchantOffer("merchant-seed", 0, itemIds);

    expect(offer.options).toHaveLength(3);
    expect(new Set(offer.options.map((option) => option.itemId))).toHaveLength(3);
    expect(offer.options.every((option) => Object.keys(option).sort().join(",") === "itemId,offerId")).toBe(true);
  });

  it("is deterministic for the same seed and cursor", () => {
    expect(createMerchantOffer("merchant-seed", 5, itemIds)).toEqual(
      createMerchantOffer("merchant-seed", 5, itemIds),
    );
  });

  it("rejects fewer than three unique candidates and invalid item ids", () => {
    expect(() => createMerchantOffer("seed", 0, ["sharp-sword", "sharp-sword"])).toThrow(/three unique/i);
    expect(() => createMerchantOffer("seed", 0, [...itemIds, "forged-item"])).toThrow(/invalid item/i);
  });

  it("only resolves an option identified by the authoritative offer", () => {
    const offer = createMerchantOffer("merchant-seed", 0, itemIds);

    expect(chooseMerchantItem(offer, offer.options[1]!.offerId)).toBe(offer.options[1]);
    expect(() => chooseMerchantItem(offer, "merchant-forged")).toThrow(/offered/i);
  });
});

describe("createTreasureOffer", () => {
  it("creates gold, item, and essence options in order with authoritative values", () => {
    const offer = createTreasureOffer("treasure-seed", 0, itemIds);

    expect(offer.options.map((option) => option.payload.kind)).toEqual(["gold", "item", "essence"]);
    expect(offer.options[0]!.payload).toMatchObject({ kind: "gold", amount: expect.any(Number) });
    expect(offer.options[1]!.payload).toMatchObject({ kind: "item", itemId: expect.stringMatching(/.+/) });
    expect(offer.options[2]!.payload).toEqual({ kind: "essence", amount: 1 });
    if (offer.options[0]!.payload.kind === "gold") {
      expect(offer.options[0]!.payload.amount).toBeGreaterThanOrEqual(6);
      expect(offer.options[0]!.payload.amount).toBeLessThanOrEqual(12);
    }
  });

  it("derives merchant and treasure offers exclusively from the reward stream", () => {
    const seed = "shared-seed";
    const initialCursor = 4;
    const expectedMerchantStream = createNamedRollStream(seed, "reward", initialCursor);
    const remainingItems = [...itemIds];
    const expectedMerchantOptions = Array.from({ length: 3 }, (_, index) => {
      const selectedIndex = expectedMerchantStream.roll(remainingItems.length) - 1;
      const [itemId] = remainingItems.splice(selectedIndex, 1);
      return {
        offerId: `merchant-${initialCursor}-${index + 1}-${expectedMerchantStream.roll(100)}`,
        itemId,
      };
    });
    const expectedMerchantCursor = expectedMerchantStream.cursor();

    const merchant = createMerchantOffer(seed, initialCursor, itemIds);
    expect(merchant).toEqual({
      options: expectedMerchantOptions,
      rngCursor: expectedMerchantCursor,
    });

    const expectedTreasureStream = createNamedRollStream(seed, "reward", expectedMerchantCursor);
    const expectedGold = expectedTreasureStream.roll(7) + 5;
    const expectedItem = itemIds[expectedTreasureStream.roll(itemIds.length) - 1];
    const expectedTreasureOptions = [
      {
        offerId: `treasure-${expectedMerchantCursor}-1-${expectedTreasureStream.roll(100)}`,
        payload: { kind: "gold", amount: expectedGold },
      },
      {
        offerId: `treasure-${expectedMerchantCursor}-2-${expectedTreasureStream.roll(100)}`,
        payload: { kind: "item", itemId: expectedItem },
      },
      {
        offerId: `treasure-${expectedMerchantCursor}-3-${expectedTreasureStream.roll(100)}`,
        payload: { kind: "essence", amount: 1 },
      },
    ];

    expect(createTreasureOffer(seed, merchant.rngCursor, itemIds)).toEqual({
      options: expectedTreasureOptions,
      rngCursor: expectedTreasureStream.cursor(),
    });
  });

  it("rejects empty candidates and invalid item ids", () => {
    expect(() => createTreasureOffer("seed", 0, [])).toThrow(/candidate/i);
    expect(() => createTreasureOffer("seed", 0, ["forged-item"])).toThrow(/invalid item/i);
  });

  it("only resolves an option identified by the authoritative offer", () => {
    const offer = createTreasureOffer("treasure-seed", 0, itemIds);

    expect(chooseTreasureReward(offer, offer.options[0]!.offerId)).toBe(offer.options[0]);
    expect(() => chooseTreasureReward(offer, "treasure-forged")).toThrow(/offered/i);
  });
});
