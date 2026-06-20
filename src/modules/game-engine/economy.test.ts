import { describe, expect, it } from "vitest";

import {
  RUN_ITEMS,
  applyCombatBonuses,
  applyEquipmentBonuses,
  applyGoldBonus,
  consumeItem,
  equipItem,
  purchaseItem,
  unequipItem,
  type EquippedSlots,
  type InventoryState,
} from "./economy";

const emptySlots = (): EquippedSlots => ({ weapon: null, armor: null, accessory: null });
const inventoryState = (overrides: Partial<InventoryState> = {}): InventoryState => ({
  inventory: [],
  consumables: {},
  equipment: { aria: emptySlots(), bram: emptySlots() },
  ...overrides,
});

describe("RUN_ITEMS", () => {
  it("defines the official immutable catalog and slots", () => {
    expect(RUN_ITEMS).toEqual({
      "sharp-sword": { id: "sharp-sword", name: "Espada Afiada", price: 8, kind: "passive", slot: "weapon" },
      "reinforced-shield": { id: "reinforced-shield", name: "Escudo Reforçado", price: 8, kind: "passive", slot: "armor" },
      "healing-potion": { id: "healing-potion", name: "Poção", price: 6, kind: "consumable", slot: "consumable" },
      "tax-amulet": { id: "tax-amulet", name: "Amuleto Fiscal", price: 12, kind: "passive", slot: "accessory" },
    });
    expect(Object.isFrozen(RUN_ITEMS)).toBe(true);
    expect(Object.values(RUN_ITEMS).every(Object.isFrozen)).toBe(true);
  });
});

describe("canonical purchaseItem", () => {
  it("charges the official price and stores equipment without applying it", () => {
    const state = { gold: 12, ...inventoryState() };
    const result = purchaseItem(state, "sharp-sword");
    expect(result).toEqual({ ...state, gold: 4, inventory: ["sharp-sword"] });
    expect(state.inventory).toEqual([]);
  });

  it("stores a potion in its stack without healing", () => {
    expect(purchaseItem({ gold: 10, ...inventoryState() }, "healing-potion")).toEqual({
      gold: 4,
      ...inventoryState({ consumables: { "healing-potion": 1 } }),
    });
  });

  it("increments potion stacks and prevents duplicate nonconsumables", () => {
    const potionState = { gold: 12, ...inventoryState({ consumables: { "healing-potion": 1 } }) };
    expect(purchaseItem(potionState, "healing-potion").consumables).toEqual({ "healing-potion": 2 });
    expect(() => purchaseItem({ gold: 10, ...inventoryState({ inventory: ["sharp-sword"] }) }, "sharp-sword"))
      .toThrow("nonconsumable already owned");
  });

  it("validates balances, inventory and stacks", () => {
    expect(() => purchaseItem({ gold: 1.5, ...inventoryState() }, "sharp-sword")).toThrow("gold must be");
    expect(() => purchaseItem({ gold: 20, ...inventoryState({ inventory: ["missing"] as never }) }, "sharp-sword"))
      .toThrow("invalid inventory item id");
    expect(() => purchaseItem({ gold: 20, ...inventoryState({ consumables: { "healing-potion": -1 } }) }, "sharp-sword"))
      .toThrow("consumable count must be");
    expect(() => purchaseItem({ gold: 20, ...inventoryState({ consumables: { "sharp-sword": 1 } as never }) }, "sharp-sword"))
      .toThrow("invalid consumable stack item");
    expect(() => purchaseItem({ gold: 20, ...inventoryState({ inventory: ["sharp-sword", "sharp-sword"] }) }, "tax-amulet"))
      .toThrow("duplicate inventory item");
    expect(() => purchaseItem({ gold: 20, ...inventoryState({ inventory: ["healing-potion"] }) }, "tax-amulet"))
      .toThrow("consumable cannot be owned in inventory");
    expect(() => purchaseItem({
      gold: 20,
      heroHp: 1,
      heroMaxHp: 24,
      inventory: [],
      consumables: {},
    } as never, "healing-potion")).toThrow("invalid equipment");
  });
});

describe("equipment", () => {
  const owned = inventoryState({ inventory: ["sharp-sword", "reinforced-shield", "tax-amulet"] });

  it("uses the official slot and replaces one item per slot while retaining ownership", () => {
    const sword = equipItem(owned, "aria", "sharp-sword");
    expect(sword.equipment.aria.weapon).toBe("sharp-sword");
    expect(equipItem(sword, "aria", "sharp-sword").equipment.aria).toEqual({
      weapon: "sharp-sword",
      armor: null,
      accessory: null,
    });
    expect(sword.inventory).toEqual(["sharp-sword", "reinforced-shield", "tax-amulet"]);
  });

  it("rejects a forged expected slot", () => {
    expect(() => equipItem(owned, "aria", "sharp-sword", "armor")).toThrow("item slot mismatch");
  });

  it("prevents one item from being equipped by two guardians", () => {
    const equipped = equipItem(owned, "aria", "sharp-sword");
    expect(() => equipItem(equipped, "bram", "sharp-sword")).toThrow("item already equipped");
  });

  it("rejects unknown guardians, items, unowned items, and consumables", () => {
    expect(() => equipItem(owned, "missing", "sharp-sword")).toThrow("unknown guardian");
    expect(() => equipItem(owned, "aria", "missing" as never)).toThrow("invalid item id");
    expect(() => equipItem(inventoryState(), "aria", "sharp-sword")).toThrow("item not owned");
    expect(() => equipItem(inventoryState({ inventory: ["healing-potion"] }), "aria", "healing-potion"))
      .toThrow("consumable cannot be equipped");
  });

  it("unequips only the requested slot and validates guardian and slot", () => {
    const equipped = equipItem(owned, "aria", "sharp-sword");
    expect(unequipItem(equipped, "aria", "weapon").equipment.aria.weapon).toBeNull();
    expect(() => unequipItem(equipped, "missing", "weapon")).toThrow("unknown guardian");
    expect(() => unequipItem(equipped, "aria", "consumable" as never)).toThrow("invalid equipment slot");
  });
});

describe("consumeItem", () => {
  it("decrements exactly once and applies official capped healing", () => {
    const state = inventoryState({ consumables: { "healing-potion": 2 } });
    expect(consumeItem(state, "aria", "healing-potion", { hp: 20, maxHp: 24 })).toEqual({
      inventoryState: inventoryState({ consumables: { "healing-potion": 1 } }),
      guardianHp: 24,
    });
  });

  it("cannot consume below zero or forge item/effect", () => {
    const state = inventoryState({ consumables: { "healing-potion": 1 } });
    const once = consumeItem(state, "aria", "healing-potion", { hp: 1, maxHp: 24 });
    expect(once.guardianHp).toBe(7);
    expect(() => consumeItem(once.inventoryState, "aria", "healing-potion", { hp: 7, maxHp: 24 })).toThrow("item not available");
    expect(() => consumeItem(state, "aria", "sharp-sword", { hp: 1, maxHp: 24 })).toThrow("item is not consumable");
    expect(() => consumeItem(state, "missing", "healing-potion", { hp: 1, maxHp: 24 })).toThrow("unknown guardian");
  });
});

describe("applyEquipmentBonuses", () => {
  const owned = ["sharp-sword", "reinforced-shield", "tax-amulet"] as const;

  it("grants no bonuses for stored but unequipped items", () => {
    expect(applyEquipmentBonuses({ attack: 3, defense: 2, gold: 10 }, owned, emptySlots()))
      .toEqual({ attack: 3, defense: 2, gold: 10 });
  });

  it("grants each official bonus only while equipped", () => {
    expect(applyEquipmentBonuses(
      { attack: 3, defense: 2, gold: 10 },
      owned,
      { weapon: "sharp-sword", armor: "reinforced-shield", accessory: "tax-amulet" },
    )).toEqual({ attack: 4, defense: 3, gold: 12 });
  });

  it("rejects forged equipment and inventories", () => {
    expect(() => applyEquipmentBonuses({ attack: 1, defense: 1, gold: 1 }, [], { ...emptySlots(), weapon: "sharp-sword" }))
      .toThrow("equipped item not owned");
    expect(() => applyEquipmentBonuses({ attack: 1, defense: 1, gold: 1 }, ["missing"] as never, emptySlots()))
      .toThrow("invalid inventory item id");
  });
});

describe("legacy compatibility wrappers", () => {
  it("preserves current consumers until they migrate", () => {
    expect(applyCombatBonuses({ damage: 3, defense: 2 }, ["sharp-sword", "reinforced-shield"]))
      .toEqual({ damage: 4, defense: 3 });
    expect(applyGoldBonus(10, ["tax-amulet"])).toBe(12);
    expect(purchaseItem({ gold: 12, heroHp: 18, heroMaxHp: 24, inventory: [] }, "healing-potion"))
      .toMatchObject({ gold: 6, heroHp: 24, inventory: [] });
  });
});
