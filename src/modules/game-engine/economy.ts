export type EquipmentSlot = "weapon" | "armor" | "accessory";
export type ItemSlot = EquipmentSlot | "consumable";

export const RUN_ITEMS = Object.freeze({
  "sharp-sword": Object.freeze({
    id: "sharp-sword",
    name: "Espada Afiada",
    price: 8,
    kind: "passive",
    slot: "weapon",
    effect: Object.freeze({ attack: 1 }),
  }),
  "dented-spear": Object.freeze({
    id: "dented-spear",
    name: "Lança Amassada",
    price: 7,
    kind: "passive",
    slot: "weapon",
    effect: Object.freeze({ attack: 1 }),
  }),
  "reinforced-shield": Object.freeze({
    id: "reinforced-shield",
    name: "Escudo Reforçado",
    price: 8,
    kind: "passive",
    slot: "armor",
    effect: Object.freeze({ defense: 1 }),
  }),
  "healing-potion": Object.freeze({
    id: "healing-potion",
    name: "Poção",
    price: 6,
    kind: "consumable",
    slot: "consumable",
    effect: Object.freeze({ heal: 6 }),
  }),
  "tax-amulet": Object.freeze({
    id: "tax-amulet",
    name: "Amuleto Fiscal",
    price: 12,
    kind: "passive",
    slot: "accessory",
    effect: Object.freeze({ goldPercent: 20 }),
  }),
} as const);

export type RunItemId = keyof typeof RUN_ITEMS;
export type RunItem = (typeof RUN_ITEMS)[RunItemId];
export type EquippedSlots = Readonly<Record<EquipmentSlot, RunItemId | null>>;
export type EquipmentByGuardian = Readonly<Record<string, EquippedSlots>>;
export type ConsumableStacks = Readonly<Partial<Record<RunItemId, number>>>;

export interface InventoryState {
  readonly inventory: readonly RunItemId[];
  readonly consumables: ConsumableStacks;
  readonly equipment: EquipmentByGuardian;
}

export interface PurchaseInventoryState extends InventoryState {
  readonly gold: number;
}

/** @deprecated Temporary compatibility shape for run/UI callers awaiting migration. */
export interface PurchaseState {
  readonly gold: number;
  readonly heroHp: number;
  readonly heroMaxHp: number;
  readonly inventory: readonly string[];
}

/** @deprecated Temporary compatibility result for run/UI callers awaiting migration. */
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

function isEquipmentSlot(slot: string): slot is EquipmentSlot {
  return slot === "weapon" || slot === "armor" || slot === "accessory";
}

type ItemEffectKey = "attack" | "defense" | "heal" | "goldPercent";

function effectValue(itemId: RunItemId, key: ItemEffectKey): number {
  const effect: Partial<Record<ItemEffectKey, number>> = RUN_ITEMS[itemId].effect;
  return effect[key] ?? 0;
}

function validateInventory(inventory: readonly string[]): asserts inventory is readonly RunItemId[] {
  if (!Array.isArray(inventory) || !inventory.every(isRunItemId)) {
    throw new Error("invalid inventory item id");
  }
}

function validateOwnedInventory(inventory: readonly string[]): asserts inventory is readonly RunItemId[] {
  validateInventory(inventory);
  const seen = new Set<RunItemId>();
  for (const id of inventory) {
    if (RUN_ITEMS[id].kind === "consumable") {
      throw new Error("consumable cannot be owned in inventory");
    }
    if (seen.has(id)) throw new Error("duplicate inventory item");
    seen.add(id);
  }
}

function validateConsumables(consumables: ConsumableStacks): void {
  if (!consumables || typeof consumables !== "object" || Array.isArray(consumables)) {
    throw new Error("invalid consumable stacks");
  }
  for (const [id, count] of Object.entries(consumables)) {
    if (!isRunItemId(id) || RUN_ITEMS[id].kind !== "consumable") {
      throw new Error("invalid consumable stack item");
    }
    if (!Number.isSafeInteger(count) || count <= 0) {
      throw new Error("consumable count must be a positive safe integer");
    }
  }
}

function validateEquippedSlots(slots: EquippedSlots, inventory: readonly RunItemId[]): void {
  if (!slots || typeof slots !== "object") throw new Error("invalid equipped slots");
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const id = slots[slot];
    if (id === null) continue;
    if (!isRunItemId(id)) throw new Error("invalid equipped item id");
    if (!inventory.includes(id)) throw new Error("equipped item not owned");
    if (RUN_ITEMS[id].slot !== slot) throw new Error("equipped item slot mismatch");
  }
}

function validateInventoryState(state: InventoryState): void {
  validateOwnedInventory(state.inventory);
  validateConsumables(state.consumables);
  if (!state.equipment || typeof state.equipment !== "object" || Array.isArray(state.equipment)) {
    throw new Error("invalid equipment");
  }
  const equipped = new Set<RunItemId>();
  for (const slots of Object.values(state.equipment)) {
    validateEquippedSlots(slots, state.inventory);
    for (const id of Object.values(slots)) {
      if (id === null) continue;
      if (equipped.has(id)) throw new Error("item already equipped");
      equipped.add(id);
    }
  }
}

export function purchaseItem(state: PurchaseInventoryState, itemId: string): PurchaseInventoryState {
  assertNonNegativeSafeInteger(state.gold, "gold");
  validateInventoryState(state);
  if (!isRunItemId(itemId)) throw new Error("invalid item id");
  const item = RUN_ITEMS[itemId];
  if (state.gold < item.price) throw new Error("not enough gold");
  if (item.kind !== "consumable" && state.inventory.includes(itemId)) {
    throw new Error("nonconsumable already owned");
  }
  return item.kind === "consumable"
    ? {
        ...state,
        gold: state.gold - item.price,
        consumables: { ...state.consumables, [itemId]: (state.consumables[itemId] ?? 0) + 1 },
      }
    : { ...state, gold: state.gold - item.price, inventory: [...state.inventory, itemId] };
}

/** @deprecated Temporary compatibility function for run/UI callers awaiting migration. */
export function purchaseLegacyItem(state: PurchaseState, itemId: string): PurchasedState {
  assertNonNegativeSafeInteger(state.gold, "gold");
  validateInventory(state.inventory);
  if (!isRunItemId(itemId)) throw new Error("invalid item id");
  const item = RUN_ITEMS[itemId];
  if (state.gold < item.price) throw new Error("not enough gold");
  assertNonNegativeSafeInteger(state.heroHp, "heroHp");
  assertNonNegativeSafeInteger(state.heroMaxHp, "heroMaxHp");
  if (state.heroHp > state.heroMaxHp) throw new Error("heroHp cannot exceed heroMaxHp");
  if (item.kind === "passive" && state.inventory.includes(itemId)) throw new Error("passive already owned");
  return {
    gold: state.gold - item.price,
    heroHp: item.kind === "consumable"
      ? Math.min(state.heroHp + item.effect.heal, state.heroMaxHp)
      : state.heroHp,
    heroMaxHp: state.heroMaxHp,
    inventory: item.kind === "passive" ? [...state.inventory, itemId] : [...state.inventory],
  };
}

function requireGuardian(state: InventoryState, guardianId: string): EquippedSlots {
  if (!Object.hasOwn(state.equipment, guardianId)) throw new Error("unknown guardian");
  return state.equipment[guardianId];
}

export function equipItem(
  state: InventoryState,
  guardianId: string,
  itemId: RunItemId,
  expectedSlot?: EquipmentSlot,
): InventoryState {
  if (!isRunItemId(itemId)) throw new Error("invalid item id");
  const item = RUN_ITEMS[itemId];
  if (item.kind === "consumable") throw new Error("consumable cannot be equipped");
  validateInventoryState(state);
  const current = requireGuardian(state, guardianId);
  if (!state.inventory.includes(itemId)) throw new Error("item not owned");
  if (expectedSlot !== undefined && (!isEquipmentSlot(expectedSlot) || expectedSlot !== item.slot)) {
    throw new Error("item slot mismatch");
  }
  for (const [otherGuardianId, slots] of Object.entries(state.equipment)) {
    if (otherGuardianId !== guardianId && Object.values(slots).includes(itemId)) {
      throw new Error("item already equipped");
    }
  }
  return {
    ...state,
    equipment: {
      ...state.equipment,
      [guardianId]: { ...current, [item.slot]: itemId },
    },
  };
}

export function unequipItem(
  state: InventoryState,
  guardianId: string,
  slot: EquipmentSlot,
): InventoryState {
  validateInventoryState(state);
  const current = requireGuardian(state, guardianId);
  if (!isEquipmentSlot(slot)) throw new Error("invalid equipment slot");
  return {
    ...state,
    equipment: { ...state.equipment, [guardianId]: { ...current, [slot]: null } },
  };
}

export interface GuardianHpContext {
  readonly hp: number;
  readonly maxHp: number;
}

export interface ConsumeItemResult {
  readonly inventoryState: InventoryState;
  readonly guardianHp: number;
}

export function consumeItem(
  state: InventoryState,
  guardianId: string,
  itemId: RunItemId,
  guardian: GuardianHpContext,
): ConsumeItemResult {
  validateInventoryState(state);
  requireGuardian(state, guardianId);
  if (!isRunItemId(itemId)) throw new Error("invalid item id");
  if (RUN_ITEMS[itemId].kind !== "consumable") throw new Error("item is not consumable");
  assertNonNegativeSafeInteger(guardian.hp, "guardian hp");
  assertNonNegativeSafeInteger(guardian.maxHp, "guardian maxHp");
  if (guardian.hp > guardian.maxHp) throw new Error("guardian hp cannot exceed maxHp");
  const count = state.consumables[itemId] ?? 0;
  if (count === 0) throw new Error("item not available");
  const consumables = { ...state.consumables };
  if (count === 1) delete consumables[itemId];
  else consumables[itemId] = count - 1;
  return {
    inventoryState: { ...state, consumables },
    guardianHp: Math.min(guardian.hp + RUN_ITEMS[itemId].effect.heal, guardian.maxHp),
  };
}

export interface EquipmentBonusStats {
  readonly attack: number;
  readonly defense: number;
  readonly gold: number;
}

export function applyEquipmentBonuses(
  stats: EquipmentBonusStats,
  ownedInventory: readonly RunItemId[],
  equippedSlots: EquippedSlots,
): EquipmentBonusStats {
  assertNonNegativeSafeInteger(stats.attack, "attack");
  assertNonNegativeSafeInteger(stats.defense, "defense");
  assertNonNegativeSafeInteger(stats.gold, "gold");
  validateOwnedInventory(ownedInventory);
  validateEquippedSlots(equippedSlots, ownedInventory);
  return {
    attack: stats.attack + (equippedSlots.weapon === null ? 0 : effectValue(equippedSlots.weapon, "attack")),
    defense: stats.defense + (equippedSlots.armor === null ? 0 : effectValue(equippedSlots.armor, "defense")),
    gold: equippedSlots.accessory === null
      ? stats.gold
      : stats.gold + Math.floor(stats.gold * effectValue(equippedSlots.accessory, "goldPercent") / 100),
  };
}

export interface CombatStats {
  readonly damage: number;
  readonly defense: number;
}

/** @deprecated Compatibility wrapper retaining owned-is-active behavior until consumers migrate. */
export function applyCombatBonuses(stats: CombatStats, inventory: readonly string[]): CombatStats {
  assertNonNegativeSafeInteger(stats.damage, "damage");
  assertNonNegativeSafeInteger(stats.defense, "defense");
  validateInventory(inventory);
  return {
    damage: stats.damage + (inventory.includes("sharp-sword") ? 1 : 0),
    defense: stats.defense + (inventory.includes("reinforced-shield") ? 1 : 0),
  };
}

/** @deprecated Compatibility wrapper retaining owned-is-active behavior until consumers migrate. */
export function applyGoldBonus(baseGold: number, inventory: readonly string[]): number {
  assertNonNegativeSafeInteger(baseGold, "baseGold");
  validateInventory(inventory);
  return inventory.includes("tax-amulet") ? baseGold + Math.floor(baseGold / 5) : baseGold;
}
