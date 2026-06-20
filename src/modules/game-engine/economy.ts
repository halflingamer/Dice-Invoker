export const RUN_ITEMS = Object.freeze({
  "sharp-sword": Object.freeze({
    id: "sharp-sword",
    name: "Espada Afiada",
    price: 8,
    kind: "passive",
  }),
  "reinforced-shield": Object.freeze({
    id: "reinforced-shield",
    name: "Escudo Reforçado",
    price: 8,
    kind: "passive",
  }),
  "healing-potion": Object.freeze({
    id: "healing-potion",
    name: "Poção",
    price: 6,
    kind: "consumable",
  }),
  "tax-amulet": Object.freeze({
    id: "tax-amulet",
    name: "Amuleto Fiscal",
    price: 12,
    kind: "passive",
  }),
} as const);

export type RunItemId = keyof typeof RUN_ITEMS;

export type RunItem = (typeof RUN_ITEMS)[RunItemId];

export interface PurchaseState {
  readonly gold: number;
  readonly heroHp: number;
  readonly heroMaxHp: number;
  readonly inventory: readonly string[];
}

export interface PurchasedState {
  readonly gold: number;
  readonly heroHp: number;
  readonly heroMaxHp: number;
  readonly inventory: readonly RunItemId[];
}

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
}

function isRunItemId(id: string): id is RunItemId {
  return Object.hasOwn(RUN_ITEMS, id);
}

function validateInventory(inventory: readonly string[]): asserts inventory is readonly RunItemId[] {
  if (!inventory.every(isRunItemId)) {
    throw new Error("invalid inventory item id");
  }
}

export function purchaseItem(state: PurchaseState, itemId: string): PurchasedState {
  assertNonNegativeSafeInteger(state.gold, "gold");
  assertNonNegativeSafeInteger(state.heroHp, "heroHp");
  assertNonNegativeSafeInteger(state.heroMaxHp, "heroMaxHp");
  if (state.heroHp > state.heroMaxHp) {
    throw new Error("heroHp cannot exceed heroMaxHp");
  }
  validateInventory(state.inventory);

  if (!isRunItemId(itemId)) {
    throw new Error("invalid item id");
  }

  const item = RUN_ITEMS[itemId];
  if (state.gold < item.price) {
    throw new Error("not enough gold");
  }
  if (item.kind === "passive" && state.inventory.includes(itemId)) {
    throw new Error("passive already owned");
  }

  return {
    gold: state.gold - item.price,
    heroHp:
      item.kind === "consumable"
        ? Math.min(state.heroHp + 6, state.heroMaxHp)
        : state.heroHp,
    heroMaxHp: state.heroMaxHp,
    inventory:
      item.kind === "passive" ? [...state.inventory, itemId] : [...state.inventory],
  };
}

export interface CombatStats {
  readonly damage: number;
  readonly defense: number;
}

export function applyCombatBonuses(
  stats: CombatStats,
  inventory: readonly string[],
): CombatStats {
  assertNonNegativeSafeInteger(stats.damage, "damage");
  assertNonNegativeSafeInteger(stats.defense, "defense");
  validateInventory(inventory);

  const damage = stats.damage + (inventory.includes("sharp-sword") ? 1 : 0);
  const defense = stats.defense + (inventory.includes("reinforced-shield") ? 1 : 0);
  assertNonNegativeSafeInteger(damage, "damage");
  assertNonNegativeSafeInteger(defense, "defense");

  return { damage, defense };
}

export function applyGoldBonus(baseGold: number, inventory: readonly string[]): number {
  assertNonNegativeSafeInteger(baseGold, "baseGold");
  validateInventory(inventory);

  const gold = inventory.includes("tax-amulet")
    ? baseGold + Math.floor(baseGold / 5)
    : baseGold;
  assertNonNegativeSafeInteger(gold, "gold");
  return gold;
}
