import { describe, expect, it } from "vitest";

import {
  RUN_ITEMS,
  applyCombatBonuses,
  applyEquipmentBonuses,
  applyGoldBonus,
  consumeItem,
  equipItem,
  purchaseLegacyItem,
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
      "sharp-sword": { id: "sharp-sword", name: "Espada Afiada", price: 8, kind: "passive", slot: "weapon", effect: { attack: 1 } },
      "dented-spear": { id: "dented-spear", name: "Lança Amassada", price: 7, kind: "passive", slot: "weapon", effect: { attack: 1 } },
      "reinforced-shield": { id: "reinforced-shield", name: "Escudo Reforçado", price: 8, kind: "passive", slot: "armor", effect: { defense: 1 } },
      "healing-potion": { id: "healing-potion", name: "Poção", price: 6, kind: "consumable", slot: "consumable", effect: { heal: 6 } },
      "tax-amulet": { id: "tax-amulet", name: "Amuleto Fiscal", price: 12, kind: "passive", slot: "accessory", effect: { goldPercent: 20 } },
    });
    expect(Object.isFrozen(RUN_ITEMS)).toBe(true);
    expect(Object.values(RUN_ITEMS).every(Object.isFrozen)).toBe(true);
  });
});

describe("canonical purchaseItem", () => {
  it("rejects legacy purchase state instead of auto-healing", () => {
    expect(() => purchaseItem({ gold: 12, heroHp: 18, heroMaxHp: 24, inventory: [] } as never, "healing-potion"))
      .toThrow("invalid consumable stacks");
  });

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

  it("rejects a potion purchase that would overflow its safe stack count", () => {
    expect(() => purchaseItem({
      gold: 6,
      ...inventoryState({ consumables: { "healing-potion": Number.MAX_SAFE_INTEGER } }),
    }, "healing-potion")).toThrow("consumable count must be a safe integer after purchase");
  });

  it("rejects an unknown item and insufficient gold", () => {
    expect(() => purchaseItem({ gold: 12, ...inventoryState() }, "missing-item")).toThrow("invalid item id");
    expect(() => purchaseItem({ gold: 7, ...inventoryState() }, "sharp-sword")).toThrow("not enough gold");
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid canonical gold %s", (gold) => {
    expect(() => purchaseItem({ gold, ...inventoryState() }, "healing-potion"))
      .toThrow("gold must be a non-negative safe integer");
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
  const owned = inventoryState({ inventory: ["sharp-sword", "dented-spear", "reinforced-shield", "tax-amulet"] });

  it("replaces a weapon with a distinct owned weapon while retaining both", () => {
    const sword = equipItem(owned, "aria", "sharp-sword");
    expect(sword.equipment.aria.weapon).toBe("sharp-sword");
    const spear = equipItem(sword, "aria", "dented-spear");
    expect(spear.equipment.aria.weapon).toBe("dented-spear");
    expect(spear.inventory).toEqual(["sharp-sword", "dented-spear", "reinforced-shield", "tax-amulet"]);
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

  it.each([
    [{ attack: Number.MAX_SAFE_INTEGER, defense: 1, gold: 1 }, { weapon: "sharp-sword", armor: null, accessory: null }, "attack"],
    [{ attack: 1, defense: Number.MAX_SAFE_INTEGER, gold: 1 }, { weapon: null, armor: "reinforced-shield", accessory: null }, "defense"],
    [{ attack: 1, defense: 1, gold: Number.MAX_SAFE_INTEGER }, { weapon: null, armor: null, accessory: "tax-amulet" }, "gold"],
  ] as const)("rejects unsafe derived %s equipment bonuses", (stats, slots, field) => {
    const inventory = Object.values(slots).filter((id): id is NonNullable<typeof id> => id !== null);
    expect(() => applyEquipmentBonuses(stats, inventory, slots)).toThrow(
      `${field} must be a non-negative safe integer`,
    );
  });
});

describe("legacy compatibility wrappers", () => {
  const legacy = { gold: 12, heroHp: 18, heroMaxHp: 24, inventory: [] as const };

  it("preserves explicitly named legacy purchase behavior until consumers migrate", () => {
    expect(applyCombatBonuses({ damage: 3, defense: 2 }, ["sharp-sword", "reinforced-shield"]))
      .toEqual({ damage: 4, defense: 3 });
    expect(applyGoldBonus(10, ["tax-amulet"])).toBe(12);
    expect(purchaseLegacyItem(legacy, "healing-potion"))
      .toMatchObject({ gold: 6, heroHp: 24, inventory: [] });
  });

  it.each([
    ["gold", -1],
    ["gold", 1.5],
    ["gold", Number.MAX_SAFE_INTEGER + 1],
    ["heroHp", -1],
    ["heroHp", 1.5],
    ["heroMaxHp", -1],
    ["heroMaxHp", Number.POSITIVE_INFINITY],
  ] as const)("rejects invalid legacy %s values", (field, value) => {
    expect(() => purchaseLegacyItem({ ...legacy, [field]: value }, "healing-potion"))
      .toThrow(`${field} must be a non-negative safe integer`);
  });

  it("rejects invalid legacy HP, item, funds, and inventory", () => {
    expect(() => purchaseLegacyItem({ ...legacy, heroHp: 25 }, "healing-potion"))
      .toThrow("heroHp cannot exceed heroMaxHp");
    expect(() => purchaseLegacyItem(legacy, "missing-item")).toThrow("invalid item id");
    expect(() => purchaseLegacyItem({ ...legacy, gold: 5 }, "healing-potion")).toThrow("not enough gold");
    expect(() => purchaseLegacyItem({ ...legacy, inventory: ["missing-item"] }, "healing-potion"))
      .toThrow("invalid inventory item id");
  });

  it("retains combat validation and duplicate nonstacking", () => {
    expect(applyCombatBonuses({ damage: 3, defense: 2 }, ["sharp-sword", "sharp-sword"]))
      .toEqual({ damage: 4, defense: 2 });
    expect(() => applyCombatBonuses({ damage: -1, defense: 2 }, [])).toThrow("damage must be a non-negative safe integer");
    expect(() => applyCombatBonuses({ damage: 1, defense: 2 }, ["unknown"])).toThrow("invalid inventory item id");
    expect(() => applyCombatBonuses({ damage: Number.MAX_SAFE_INTEGER, defense: 2 }, ["sharp-sword"]))
      .toThrow("damage must be a non-negative safe integer");
    expect(() => applyCombatBonuses({ damage: 1, defense: Number.MAX_SAFE_INTEGER }, ["reinforced-shield"]))
      .toThrow("defense must be a non-negative safe integer");
  });

  it("retains tax rounding, safe large values, duplicate nonstacking, and validation", () => {
    expect(applyGoldBonus(9, ["tax-amulet"])).toBe(10);
    expect(applyGoldBonus(4_054_199_049_377_828, ["tax-amulet"])).toBe(4_865_038_859_253_393);
    expect(applyGoldBonus(10, ["tax-amulet", "tax-amulet"])).toBe(12);
    expect(() => applyGoldBonus(1.5, [])).toThrow("baseGold must be a non-negative safe integer");
    expect(() => applyGoldBonus(1, ["unknown"])).toThrow("invalid inventory item id");
    expect(() => applyGoldBonus(Number.MAX_SAFE_INTEGER, ["tax-amulet"]))
      .toThrow("gold must be a non-negative safe integer");
  });
});
