import { describe, expect, it } from "vitest";

import {
  RUN_ITEMS,
  applyCombatBonuses,
  applyGoldBonus,
  purchaseItem,
} from "./economy";

describe("RUN_ITEMS", () => {
  it("exposes the immutable temporary run item catalog", () => {
    expect(RUN_ITEMS).toEqual({
      "sharp-sword": { id: "sharp-sword", name: "Espada Afiada", price: 8, kind: "passive" },
      "reinforced-shield": {
        id: "reinforced-shield",
        name: "Escudo Reforçado",
        price: 8,
        kind: "passive",
      },
      "healing-potion": { id: "healing-potion", name: "Poção", price: 6, kind: "consumable" },
      "tax-amulet": { id: "tax-amulet", name: "Amuleto Fiscal", price: 12, kind: "passive" },
    });
    expect(Object.isFrozen(RUN_ITEMS)).toBe(true);
    expect(Object.values(RUN_ITEMS).every(Object.isFrozen)).toBe(true);
  });
});

describe("purchaseItem", () => {
  const state = { gold: 12, heroHp: 18, heroMaxHp: 24, inventory: [] as const };

  it("charges for a passive and adds it without mutating the input", () => {
    expect(purchaseItem(state, "sharp-sword")).toEqual({
      gold: 4,
      heroHp: 18,
      heroMaxHp: 24,
      inventory: ["sharp-sword"],
    });
    expect(state).toEqual({ gold: 12, heroHp: 18, heroMaxHp: 24, inventory: [] });
  });

  it("rejects an unknown item id", () => {
    expect(() => purchaseItem(state, "missing-item")).toThrow("invalid item id");
  });

  it("rejects insufficient gold", () => {
    expect(() =>
      purchaseItem({ ...state, gold: 7 }, "sharp-sword"),
    ).toThrow("not enough gold");
  });

  it("rejects buying the same passive twice", () => {
    expect(() =>
      purchaseItem({ ...state, inventory: ["sharp-sword"] }, "sharp-sword"),
    ).toThrow("passive already owned");
  });

  it("consumes a potion immediately and caps healing at maximum hp", () => {
    expect(purchaseItem(state, "healing-potion")).toEqual({
      gold: 6,
      heroHp: 24,
      heroMaxHp: 24,
      inventory: [],
    });
    expect(
      purchaseItem({ ...state, heroHp: 23 }, "healing-potion"),
    ).toMatchObject({ heroHp: 24, inventory: [] });
  });

  it.each([
    ["gold", -1],
    ["gold", 1.5],
    ["gold", Number.MAX_SAFE_INTEGER + 1],
    ["heroHp", -1],
    ["heroHp", 1.5],
    ["heroMaxHp", -1],
    ["heroMaxHp", Number.POSITIVE_INFINITY],
  ] as const)("rejects invalid %s values", (field, value) => {
    expect(() => purchaseItem({ ...state, [field]: value }, "healing-potion")).toThrow(
      `${field} must be a non-negative safe integer`,
    );
  });

  it("rejects hp above maximum hp", () => {
    expect(() =>
      purchaseItem({ ...state, heroHp: 25 }, "healing-potion"),
    ).toThrow("heroHp cannot exceed heroMaxHp");
  });

  it("rejects invalid inventory ids", () => {
    expect(() =>
      purchaseItem({ ...state, inventory: ["missing-item"] }, "healing-potion"),
    ).toThrow("invalid inventory item id");
  });
});

describe("applyCombatBonuses", () => {
  it("adds one damage for a sword and one defense for a shield", () => {
    expect(
      applyCombatBonuses({ damage: 3, defense: 2 }, ["sharp-sword", "reinforced-shield"]),
    ).toEqual({ damage: 4, defense: 3 });
  });

  it("does not stack duplicate inventory ids", () => {
    expect(applyCombatBonuses({ damage: 3, defense: 2 }, ["sharp-sword", "sharp-sword"])).toEqual({
      damage: 4,
      defense: 2,
    });
  });

  it("validates stats and inventory ids", () => {
    expect(() => applyCombatBonuses({ damage: -1, defense: 2 }, [])).toThrow(
      "damage must be a non-negative safe integer",
    );
    expect(() => applyCombatBonuses({ damage: 1, defense: 2 }, ["unknown"])).toThrow(
      "invalid inventory item id",
    );
  });
});

describe("applyGoldBonus", () => {
  it("increases gold by twenty percent rounded down with the tax amulet", () => {
    expect(applyGoldBonus(10, ["tax-amulet"])).toBe(12);
    expect(applyGoldBonus(9, ["tax-amulet"])).toBe(10);
  });

  it("does not stack duplicate amulets", () => {
    expect(applyGoldBonus(10, ["tax-amulet", "tax-amulet"])).toBe(12);
  });

  it("validates base gold and inventory ids", () => {
    expect(() => applyGoldBonus(1.5, [])).toThrow(
      "baseGold must be a non-negative safe integer",
    );
    expect(() => applyGoldBonus(1, ["unknown"])).toThrow("invalid inventory item id");
  });
});
