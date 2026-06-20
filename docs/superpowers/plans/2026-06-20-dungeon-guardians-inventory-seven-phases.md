# Dungeon Guardians, Inventory, and Seven Phases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Dice Invoker into a dungeon-defense roguelike with a Slime guardian, seven escalating phases, server-authoritative equipment, simplified attack-versus-defense combat, central route selection, and terminal victory/defeat screens.

**Architecture:** Keep the existing reducer, deterministic RNG channels, strict command schemas, and room modules. Add data-driven campaign definitions and equipment rules to the game engine, migrate run state to guardian/invader terminology at API boundaries, then replace the preview-only combat orchestration with a small campaign controller consumed by focused map, inventory, combat, and result components.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Vitest, Testing Library, Phaser 4, Prisma-backed run service, static Hostinger preview.

---

## File structure

- `src/modules/content/schema.ts`: guardian, evolution, invader, and campaign validation.
- `src/modules/content/season-1.ts`: Slime evolution tree, seven phase definitions, and invading bosses.
- `src/modules/game-engine/campaign.ts`: phase lookup, difficulty scaling, and phase-map generation.
- `src/modules/game-engine/map.ts`: variable-length maps with two or three choices per layer.
- `src/modules/game-engine/economy.ts`: typed inventory stacks, equipment slots, and equipped-only bonuses.
- `src/modules/game-engine/combat.ts`: one attack die per combatant and fixed-defense resolution.
- `src/modules/run/state.ts`: authoritative guardian, phase, equipment, and terminal outcome state.
- `src/modules/run/command-schema.ts`: strict inventory and new-run commands.
- `src/modules/run/reducer.ts`: room, combat, equipment, phase, victory, and defeat transitions.
- `src/modules/run/run-service.ts`: persisted-state validation and safe migration defaults.
- `src/components/game/use-preview-campaign.ts`: local Hostinger preview state machine mirroring server rules.
- `src/components/game/CampaignMap.tsx`: central map surface and phase transition presentation.
- `src/components/game/InventoryDrawer.tsx`: map-only equipment and consumable UI.
- `src/components/game/CombatDiceOverlay.tsx`: two independently anchored attack dice.
- `src/components/game/RunResult.tsx`: terminal victory/defeat screen.
- `src/components/game/CombatStage.tsx`: composition only; delegates stateful behavior to the controller.
- `src/components/game/PhaserBattle.tsx`: guardian/invader labels and die anchor hooks.
- `src/app/globals.css`: thematic responsive map, drawer, overhead dice, critical, and result styles.

## Task 1: Model the dungeon-defense season content

**Files:**
- Modify: `src/modules/content/schema.ts`
- Modify: `src/modules/content/season-1.ts`
- Modify: `src/modules/content/content-loader.ts`
- Modify: `src/modules/content/content-loader.test.ts`

- [ ] **Step 1: Write failing content tests**

Add tests asserting the new vocabulary, D20 terminal stages, natural defense, and seven ordered phases:

```ts
it("loads the Slime guardian and its D20 evolution leaves", () => {
  const season = loadSeason(seasonOne);
  expect(season.guardians[0]).toMatchObject({ id: "caretaker-slime", unlock: { kind: "starter" } });
  expect(season.evolutionStages.filter((stage) => stage.sides === 20)).not.toHaveLength(0);
  expect(season.evolutionStages.every((stage) => stage.naturalDefense >= 0)).toBe(true);
});

it("loads seven escalating dungeon phases", () => {
  const season = loadSeason(seasonOne);
  expect(season.phases.map((phase) => phase.roomCount)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  expect(season.phases.map((phase) => phase.difficulty)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(new Set(season.phases.map((phase) => phase.bossInvaderId)).size).toBe(7);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/modules/content/content-loader.test.ts`

Expected: FAIL because `guardians`, `evolutionStages`, `naturalDefense`, and `phases` do not exist.

- [ ] **Step 3: Replace the content schemas with explicit guardian campaign types**

Define these exact additions while preserving dice and event schemas:

```ts
const combatSidesSchema = z.union([
  z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12), z.literal(20),
]);

export const guardianSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(80),
  rarity: raritySchema,
  maxHp: z.number().int().positive().max(999),
  naturalDefense: z.number().int().nonnegative().max(99),
  startingDiceIds: z.array(idSchema).min(1).max(6),
  rootEvolutionStageId: idSchema,
  unlock: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("starter") }).strict(),
    z.object({ kind: z.literal("achievement"), achievementId: idSchema }).strict(),
  ]),
}).strict();

export const evolutionStageSchema = z.object({
  id: idSchema,
  guardianId: idSchema,
  name: z.string().min(1).max(80),
  sides: combatSidesSchema,
  naturalDefense: z.number().int().nonnegative().max(99),
  xpThreshold: z.number().int().nonnegative().max(100_000),
  role: z.enum(["balanced", "assault", "defense"]),
  nextStageIds: z.array(idSchema).refine((ids) => ids.length === 0 || ids.length === 2),
}).strict();

export const invaderSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(80),
  rank: z.enum(["common", "elite", "boss"]),
  maxHp: z.number().int().positive().max(9999),
  naturalDefense: z.number().int().nonnegative().max(99),
  attackDie: combatSidesSchema,
}).strict();

export const dungeonPhaseSchema = z.object({
  id: idSchema,
  index: z.number().int().min(1).max(7),
  name: z.string().min(1).max(100),
  roomCount: z.number().int().min(3).max(9),
  difficulty: z.number().int().min(1).max(7),
  bossInvaderId: idSchema,
}).strict();
```

Update `seasonSchema` to expose `guardians`, `evolutionStages`, `invaders`, and a seven-element `phases` array. Update loader cross-reference checks so every root stage, branch, guardian ID, and boss invader ID exists.

- [ ] **Step 4: Populate Season 1**

Create the starter guardian and six-sided ladder:

```ts
const guardians: Guardian[] = [{
  id: "caretaker-slime",
  name: "Slime Zelador",
  rarity: "common",
  maxHp: 28,
  naturalDefense: 1,
  startingDiceIds: ["slime-hammer"],
  rootEvolutionStageId: "caretaker-slime-d4",
  unlock: { kind: "starter" },
}];

const EVOLUTION_SIDES = [4, 6, 8, 10, 12, 20] as const;
```

Build two branches at every nonterminal tier, with D20 terminal leaves, increasing `naturalDefense` on defensive branches. Add the seven named bosses from the approved spec and the phase table `[3,4,5,6,7,8,9]`. Rename season to `A Privatização da Dungeon`.

- [ ] **Step 5: Run content tests and typecheck**

Run: `npm test -- src/modules/content/content-loader.test.ts && npm run typecheck`

Expected: PASS with all references valid and no TypeScript errors in migrated consumers.

- [ ] **Step 6: Commit the content migration**

```bash
git add src/modules/content/schema.ts src/modules/content/season-1.ts src/modules/content/content-loader.ts src/modules/content/content-loader.test.ts
git commit -m "feat: redefine season around dungeon guardians"
```

## Task 2: Generate seven fair phase maps

**Files:**
- Create: `src/modules/game-engine/campaign.ts`
- Create: `src/modules/game-engine/campaign.test.ts`
- Modify: `src/modules/game-engine/map.ts`
- Modify: `src/modules/game-engine/map.test.ts`
- Modify: `src/modules/game-engine/map-simulation.test.ts`

- [ ] **Step 1: Write failing campaign and map tests**

```ts
it.each([3, 4, 5, 6, 7, 8, 9])("creates %i choice layers plus a boss", (roomCount) => {
  const map = generateMap({ seed: `phase-seed-${roomCount}`, phaseIndex: roomCount - 2, roomCount });
  expect(map.layers).toHaveLength(roomCount + 1);
  expect(map.layers.slice(0, -1).every((layer) => layer.nodes.length === 2 || layer.nodes.length === 3)).toBe(true);
  expect(map.layers.at(-1)?.nodes).toEqual([
    expect.objectContaining({ type: "boss", nextNodeIds: [] }),
  ]);
});

it("builds all seven phases with isolated deterministic seeds", () => {
  const campaign = createCampaignMaps("private-run-seed", seasonOne.phases);
  expect(campaign).toHaveLength(7);
  expect(campaign.map((entry) => entry.map.layers.length)).toEqual([4, 5, 6, 7, 8, 9, 10]);
  expect(createCampaignMaps("private-run-seed", seasonOne.phases)).toEqual(campaign);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/modules/game-engine/map.test.ts src/modules/game-engine/campaign.test.ts`

Expected: FAIL because `generateMap` accepts a string and `createCampaignMaps` is missing.

- [ ] **Step 3: Parameterize map generation**

Change the API to:

```ts
export type GenerateMapInput = Readonly<{
  seed: string;
  phaseIndex: number;
  roomCount: number;
}>;

export function generateMap(input: GenerateMapInput): RunMap {
  const stream = createNamedRollStream(`${input.seed}:phase:${input.phaseIndex}`, "map");
  const choiceLayers = createTopology(stream, input.roomCount);
  return finalizeMap([...choiceLayers, createBossLayer(input.roomCount + 1)], stream);
}
```

Every choice layer must contain exactly two or three nodes. Preserve no-consecutive-elite, no-three-identical-room, and guaranteed-recovery-path checks. Namespace node IDs as `phase-${phaseIndex}-room-${layer}-${node}`.

- [ ] **Step 4: Add campaign helpers**

```ts
export type CampaignPhaseMap = Readonly<{
  phaseId: string;
  phaseIndex: number;
  difficulty: number;
  bossInvaderId: string;
  map: RunMap;
}>;

export function createCampaignMaps(seed: string, phases: readonly DungeonPhase[]): readonly CampaignPhaseMap[] {
  return phases.map((phase) => ({
    phaseId: phase.id,
    phaseIndex: phase.index,
    difficulty: phase.difficulty,
    bossInvaderId: phase.bossInvaderId,
    map: generateMap({ seed, phaseIndex: phase.index, roomCount: phase.roomCount }),
  }));
}
```

- [ ] **Step 5: Run deterministic simulations**

Run: `npm test -- src/modules/game-engine/map.test.ts src/modules/game-engine/map-simulation.test.ts src/modules/game-engine/campaign.test.ts`

Expected: PASS across at least 1,000 generated campaign seeds with all topology invariants preserved.

- [ ] **Step 6: Commit phase generation**

```bash
git add src/modules/game-engine/campaign.ts src/modules/game-engine/campaign.test.ts src/modules/game-engine/map.ts src/modules/game-engine/map.test.ts src/modules/game-engine/map-simulation.test.ts
git commit -m "feat: generate seven escalating dungeon phases"
```

## Task 3: Add authoritative inventory and equipment slots

**Files:**
- Modify: `src/modules/game-engine/economy.ts`
- Modify: `src/modules/game-engine/economy.test.ts`

- [ ] **Step 1: Write failing slot and bonus tests**

```ts
const emptyEquipment = { "caretaker-slime": { weapon: null, armor: null, accessory: null } } as const;

it("grants no passive bonus to items stored but not equipped", () => {
  expect(applyEquipmentBonuses({ attack: 4, defense: 1, gold: 10 }, ["sharp-sword"], emptyEquipment["caretaker-slime"]))
    .toEqual({ attack: 4, defense: 1, gold: 10 });
});

it("enforces one item per slot and moves equipment atomically", () => {
  const next = equipItem({ inventory: ["sharp-sword", "tax-amulet"], equipment: emptyEquipment }, "caretaker-slime", "sharp-sword");
  expect(next.equipment["caretaker-slime"].weapon).toBe("sharp-sword");
  expect(() => equipItem(next, "caretaker-slime", "tax-amulet", "weapon")).toThrow(/slot type/i);
});

it("stores purchased potions until explicitly consumed", () => {
  const bought = purchaseItem({ gold: 12, inventory: [], consumables: {} }, "healing-potion");
  expect(bought.consumables["healing-potion"]).toBe(1);
});
```

- [ ] **Step 2: Run the economy tests and verify RED**

Run: `npm test -- src/modules/game-engine/economy.test.ts`

Expected: FAIL because equipment slots, consumable stacks, and `applyEquipmentBonuses` are absent.

- [ ] **Step 3: Define item types and equipment state**

Use these public types:

```ts
export type EquipmentSlot = "weapon" | "armor" | "accessory";
export type EquippedSlots = Readonly<Record<EquipmentSlot, RunItemId | null>>;
export type EquipmentByGuardian = Readonly<Record<string, EquippedSlots>>;
export type ConsumableStacks = Readonly<Partial<Record<RunItemId, number>>>;

export type InventoryState = Readonly<{
  inventory: readonly RunItemId[];
  consumables: ConsumableStacks;
  equipment: EquipmentByGuardian;
}>;
```

Give each `RUN_ITEMS` entry a `slot` of `weapon`, `armor`, `accessory`, or `consumable`. Implement pure `equipItem`, `unequipItem`, `consumeItem`, and `applyEquipmentBonuses`. Validate item ownership, guardian existence, slot compatibility, and cross-guardian uniqueness.

- [ ] **Step 4: Make purchases add inventory instead of applying effects**

`purchaseItem` subtracts official price, adds passive item ownership, or increments a consumable stack. It must not heal or apply a passive bonus at purchase time.

- [ ] **Step 5: Run economy tests**

Run: `npm test -- src/modules/game-engine/economy.test.ts`

Expected: PASS for stored, equipped, duplicate, wrong-slot, and consumed-item cases.

- [ ] **Step 6: Commit inventory rules**

```bash
git add src/modules/game-engine/economy.ts src/modules/game-engine/economy.test.ts
git commit -m "feat: add guardian equipment inventory"
```

## Task 4: Simplify combat to attack dice and fixed defense

**Files:**
- Modify: `src/modules/game-engine/types.ts`
- Modify: `src/modules/game-engine/combat.ts`
- Modify: `src/modules/game-engine/combat.test.ts`

- [ ] **Step 1: Write failing combat tests**

```ts
it("subtracts fixed natural and equipment defense", () => {
  expect(resolveCombatExchange({
    guardianHp: 20,
    invaderHp: 10,
    guardianAttack: 6,
    guardianDefense: 2,
    invaderAttack: 5,
    invaderDefense: 3,
  })).toEqual({
    guardianHp: 17,
    invaderHp: 7,
    damageDealt: 3,
    damageTaken: 3,
    victory: false,
    defeat: false,
  });
});

it("marks only the maximum face as critical", () => {
  expect(createAttackRoll(6, 6)).toMatchObject({ result: 6, critical: true });
  expect(createAttackRoll(6, 5)).toMatchObject({ result: 5, critical: false });
});

it("does not counterattack after the invader is defeated", () => {
  const result = resolveCombatExchange({ guardianHp: 4, invaderHp: 2, guardianAttack: 4, guardianDefense: 0, invaderAttack: 20, invaderDefense: 0 });
  expect(result).toMatchObject({ guardianHp: 4, invaderHp: 0, victory: true, defeat: false });
});
```

- [ ] **Step 2: Run combat tests and verify RED**

Run: `npm test -- src/modules/game-engine/combat.test.ts`

Expected: FAIL because current types use hero damage/defense dice and have no critical field.

- [ ] **Step 3: Introduce attack roll types**

```ts
export type CombatDieSides = 4 | 6 | 8 | 10 | 12 | 20;
export type AttackRoll = Readonly<{ sides: CombatDieSides; result: number; critical: boolean }>;
export type CombatExchangeInput = Readonly<{
  guardianHp: number;
  invaderHp: number;
  guardianAttack: number;
  guardianDefense: number;
  invaderAttack: number;
  invaderDefense: number;
}>;

export function createAttackRoll(sides: CombatDieSides, result: number): AttackRoll {
  if (!Number.isInteger(result) || result < 1 || result > sides) throw new Error("invalid attack roll");
  return { sides, result, critical: result === sides };
}
```

Implement exchange order as guardian hit, early victory, invader hit, then defeat. Clamp damage and HP at zero.

- [ ] **Step 4: Run combat tests and typecheck**

Run: `npm test -- src/modules/game-engine/combat.test.ts && npm run typecheck`

Expected: combat tests PASS; typecheck identifies only planned run/UI migrations, which must be resolved within this task before commit.

- [ ] **Step 5: Commit combat engine changes**

```bash
git add src/modules/game-engine/types.ts src/modules/game-engine/combat.ts src/modules/game-engine/combat.test.ts
git commit -m "feat: resolve attack dice against fixed defense"
```

## Task 5: Migrate authoritative run state and strict commands

**Files:**
- Modify: `src/modules/run/state.ts`
- Modify: `src/modules/run/command-schema.ts`
- Modify: `src/modules/run/create-run.ts`
- Modify: `src/modules/run/run-service.ts`
- Modify: `src/modules/run/run-service.test.ts`
- Modify: `src/modules/run/run-command-handler.test.ts`

- [ ] **Step 1: Write failing state and command validation tests**

```ts
it("creates a run at phase one with the Slime guardian and empty slots", () => {
  const state = createRun({ seed: "guardian-run-seed", guardianId: "caretaker-slime" });
  expect(state).toMatchObject({ campaignPhaseIndex: 1, outcome: "ongoing", guardianId: "caretaker-slime" });
  expect(state.equipment["caretaker-slime"]).toEqual({ weapon: null, armor: null, accessory: null });
});

it.each([
  { type: "EQUIP_ITEM", sequence: 1, commandId: "cmd-1", guardianId: "caretaker-slime", itemId: "sharp-sword", attack: 999 },
  { type: "UNEQUIP_ITEM", sequence: 1, commandId: "cmd-2", guardianId: "caretaker-slime", slot: "weapon", defense: 999 },
])("rejects forged inventory fields", (command) => {
  expect(() => runCommandSchema.parse(command)).toThrow();
});
```

- [ ] **Step 2: Run focused run tests and verify RED**

Run: `npm test -- src/modules/run/run-service.test.ts src/modules/run/run-command-handler.test.ts`

Expected: FAIL because guardian campaign state and inventory commands are missing.

- [ ] **Step 3: Add the authoritative fields**

Replace hero/enemy boundary names with:

```ts
type RunOutcome = "ongoing" | "victory" | "defeat";

type RunState = Readonly<{
  campaignPhaseIndex: number;
  completedRoomCount: number;
  outcome: RunOutcome;
  guardianId: string;
  unlockedGuardianIds: readonly string[];
  guardianHp: number;
  guardianMaxHp: number;
  guardianNaturalDefense: number;
  invaderId: string | null;
  invaderHp: number;
  invaderMaxHp: number;
  invaderNaturalDefense: number;
  inventory: readonly RunItemId[];
  consumables: ConsumableStacks;
  equipment: EquipmentByGuardian;
}>;
```

Keep existing RNG cursors, room state, gold, essence, progression, and audit fields. `createRun` accepts `{ seed, guardianId }`, starts phase 1, and creates all seven deterministic phase maps or the current phase map plus phase seed metadata.

- [ ] **Step 4: Add strict inventory commands**

```ts
z.object({ type: z.literal("EQUIP_ITEM"), sequence, commandId: id, guardianId: id, itemId: id }).strict(),
z.object({ type: z.literal("UNEQUIP_ITEM"), sequence, commandId: id, guardianId: id, slot: z.enum(["weapon", "armor", "accessory"]) }).strict(),
z.object({ type: z.literal("USE_CONSUMABLE"), sequence, commandId: id, guardianId: id, itemId: id }).strict(),
z.object({ type: z.literal("START_NEW_RUN"), sequence, commandId: id }).strict(),
```

Remove `REROLL_COMBAT_DIE` defense support. A reroll, if retained, targets only `guardianAttack`.

- [ ] **Step 5: Validate persisted state safely**

Update Zod persisted-state schemas with exact slot keys, known content IDs, safe integer bounds, phase range 1–7, and terminal outcome consistency. Legacy preview states may default missing equipment to empty slots; forged or contradictory states must throw a generic invalid-state error.

- [ ] **Step 6: Run state, service, and security tests**

Run: `npm test -- src/modules/run/run-service.test.ts src/modules/run/run-command-handler.test.ts tests/security/run-api.test.ts`

Expected: PASS; serialized errors do not contain seed, private offer IDs, or internal validation paths.

- [ ] **Step 7: Commit state migration**

```bash
git add src/modules/run/state.ts src/modules/run/command-schema.ts src/modules/run/create-run.ts src/modules/run/run-service.ts src/modules/run/run-service.test.ts src/modules/run/run-command-handler.test.ts
git commit -m "feat: migrate runs to guardian campaign state"
```

## Task 6: Implement reducer combat, inventory, phase, and terminal transitions

**Files:**
- Modify: `src/modules/run/reducer.ts`
- Modify: `src/modules/run/reducer.test.ts`
- Modify: `src/modules/security/rate-limit.ts`
- Modify: `src/modules/security/rate-limit.test.ts`

- [ ] **Step 1: Write failing reducer tests**

```ts
it("allows equipment only while the central map is active", () => {
  const mapState = stateWithOwnedItem("sharp-sword");
  const equipped = applyCommand(mapState, equipCommand("sharp-sword"));
  expect(equipped.equipment["caretaker-slime"].weapon).toBe("sharp-sword");
  expect(() => applyCommand({ ...mapState, phase: "combat-rolling" }, equipCommand("sharp-sword"))).toThrow(/phase/i);
});

it("advances from each boss to the next phase and wins after phase seven", () => {
  const phaseOne = defeatedBossState({ campaignPhaseIndex: 1 });
  expect(resolveCurrentCombat(phaseOne)).toMatchObject({ campaignPhaseIndex: 2, phase: "map-reveal", outcome: "ongoing" });
  const phaseSeven = defeatedBossState({ campaignPhaseIndex: 7 });
  expect(resolveCurrentCombat(phaseSeven)).toMatchObject({ outcome: "victory", phase: "complete" });
});

it("makes defeat terminal", () => {
  const defeated = resolveLethalInvaderAttack(activeCombatState());
  expect(defeated).toMatchObject({ guardianHp: 0, outcome: "defeat", phase: "complete", combatTurn: null });
  expect(() => applyCommand(defeated, beginCombatCommand(defeated.sequence + 1))).toThrow(/phase/i);
});
```

- [ ] **Step 2: Run reducer tests and verify RED**

Run: `npm test -- src/modules/run/reducer.test.ts`

Expected: FAIL because the reducer still rolls defense and completes the run after the first boss.

- [ ] **Step 3: Replace combat turn creation and resolution**

`BEGIN_COMBAT_TURN` rolls guardian attack from the current evolution stage and invader attack from content. `RESOLVE_COMBAT_TURN` derives fixed defenses from the current stage, invader content, and equipped slots. Store only official rolls and derived critical flags.

- [ ] **Step 4: Add equipment command cases**

For `EQUIP_ITEM`, `UNEQUIP_ITEM`, and `USE_CONSUMABLE`, require `phase === "room-choice"`, `pendingRoom === null`, `outcome === "ongoing"`, and no current combat. Delegate to pure economy functions and remember `commandId` idempotently.

- [ ] **Step 5: Add phase and terminal transitions**

On nonboss victory, clear combat state and return to `room-choice`. On boss victory for phases 1–6, increment phase, replace map/current route fields, set `map-reveal`, and preserve inventory, equipment, HP, gold, XP, and evolution. On phase 7 boss victory, set `victory`. On guardian death, set `defeat` and clear all pending actions.

- [ ] **Step 6: Add rate-limit buckets**

Map the three inventory commands to `{ bucket: "inventory", limit: 30, windowMs: 60_000 }` and new-run to `{ bucket: "new-run", limit: 5, windowMs: 60_000 }`. Keep keys scoped to user and run.

- [ ] **Step 7: Run reducer and security tests**

Run: `npm test -- src/modules/run/reducer.test.ts src/modules/security/rate-limit.test.ts tests/security/run-api.test.ts`

Expected: PASS for seven-phase progression, inventory phase locks, idempotency, and terminal state rejection.

- [ ] **Step 8: Commit authoritative orchestration**

```bash
git add src/modules/run/reducer.ts src/modules/run/reducer.test.ts src/modules/security/rate-limit.ts src/modules/security/rate-limit.test.ts
git commit -m "feat: orchestrate guardian campaign transitions"
```

## Task 7: Build the preview campaign controller

**Files:**
- Create: `src/components/game/use-preview-campaign.ts`
- Create: `src/components/game/use-preview-campaign.test.tsx`
- Modify: `src/components/game/preview-run-adapter.ts`

- [ ] **Step 1: Write failing hook tests with fake timers**

```tsx
it("returns to the map after a room resolves", () => {
  const { result } = renderHook(() => usePreviewCampaign({ seed: "preview-seed" }));
  act(() => result.current.chooseRoom(result.current.availableRoomIds[0]!));
  act(() => result.current.resolveRoomForTest());
  expect(result.current.surface).toBe("map");
  expect(result.current.availableRoomIds).toHaveLength(expect.any(Number));
});

it("stops every combat timer on defeat", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => usePreviewCampaign({ seed: "defeat-seed", guardianHp: 1 }));
  act(() => result.current.startCombatForTest({ invaderAttack: 20 }));
  act(() => vi.runAllTimers());
  expect(result.current.outcome).toBe("defeat");
  const roomCount = result.current.completedRoomCount;
  act(() => vi.runAllTimers());
  expect(result.current.completedRoomCount).toBe(roomCount);
});
```

- [ ] **Step 2: Run hook tests and verify RED**

Run: `npm test -- src/components/game/use-preview-campaign.test.tsx`

Expected: FAIL because the controller is missing.

- [ ] **Step 3: Implement a reducer-backed preview controller**

Expose a stable view model:

```ts
type CampaignSurface = "map" | "combat" | "merchant" | "treasure" | "event" | "promotion" | "result";

type PreviewCampaignView = Readonly<{
  surface: CampaignSurface;
  campaignPhaseIndex: number;
  currentMap: RunMap;
  availableRoomIds: readonly string[];
  visitedRoomIds: readonly string[];
  inventoryOpen: boolean;
  outcome: RunOutcome;
  chooseRoom(roomId: string): void;
  openInventory(): void;
  closeInventory(): void;
  equip(itemId: RunItemId): void;
  unequip(slot: EquipmentSlot): void;
  useConsumable(itemId: RunItemId): void;
  startNewRun(): void;
}>;
```

Use functional state updates and refs for transient timers. Cleanup all timers on encounter change, outcome change, and unmount. Reuse engine functions rather than duplicating damage, equipment, or map rules.

- [ ] **Step 4: Make the adapter generate all seven preview maps**

Replace the hard-coded ten-layer `previewRunMap` with `previewCampaignMaps = createCampaignMaps("hostinger-preview-season-1", seasonOne.phases)`.

- [ ] **Step 5: Run hook and adapter tests**

Run: `npm test -- src/components/game/use-preview-campaign.test.tsx src/components/game/preview-run-adapter.test.ts`

Expected: PASS with no act warnings and no timer continuing after terminal outcomes.

- [ ] **Step 6: Commit preview controller**

```bash
git add src/components/game/use-preview-campaign.ts src/components/game/use-preview-campaign.test.tsx src/components/game/preview-run-adapter.ts src/components/game/preview-run-adapter.test.ts
git commit -m "feat: add seven-phase preview campaign controller"
```

## Task 8: Make the map central and add the inventory drawer

**Files:**
- Create: `src/components/game/CampaignMap.tsx`
- Create: `src/components/game/CampaignMap.test.tsx`
- Create: `src/components/game/InventoryDrawer.tsx`
- Create: `src/components/game/InventoryDrawer.test.tsx`
- Modify: `src/components/game/RunMap.tsx`
- Modify: `src/components/game/CombatStage.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing component tests**

```tsx
it("shows the route as the main surface only between rooms", () => {
  const { rerender } = render(<CampaignMap surface="map" {...mapProps} />);
  expect(screen.getByRole("region", { name: "Escolha o próximo local" })).toBeVisible();
  rerender(<CampaignMap surface="combat" {...mapProps} />);
  expect(screen.queryByRole("region", { name: "Escolha o próximo local" })).toBeNull();
});

it("renders one slot per equipment type and four locked guardian cards", () => {
  render(<InventoryDrawer open guardianId="caretaker-slime" {...inventoryProps} />);
  expect(screen.getAllByRole("button", { name: /equipar|desequipar/i })).not.toHaveLength(0);
  expect(screen.getByText("Arma")).toBeVisible();
  expect(screen.getByText("Armadura")).toBeVisible();
  expect(screen.getByText("Acessório")).toBeVisible();
  expect(screen.getAllByText("Bloqueado")).toHaveLength(4);
});
```

- [ ] **Step 2: Run component tests and verify RED**

Run: `npm test -- src/components/game/CampaignMap.test.tsx src/components/game/InventoryDrawer.test.tsx`

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement the central map surface**

`CampaignMap` renders the phase name, `Fase X/7`, route graph, completed-path legend, and two or three reachable Location Dice. It returns `null` for non-map surfaces. Reuse `RunMap` graph calculations but render as a central `<section>` rather than an `<aside>`.

- [ ] **Step 4: Implement the inventory drawer**

Render official item names/effects from `RUN_ITEMS`, equipped state by slot, consumable counts, a close button, and four locked guardian cards. Disable all actions when `canManage` is false; do not optimistically calculate bonuses in the component.

- [ ] **Step 5: Refactor `CombatStage` into composition**

Use `usePreviewCampaign` once, then switch on `surface`. The battle canvas exists only for `combat`; map, merchant, treasure, event, promotion, and result each own the main area. The inventory button exists only on the map surface.

- [ ] **Step 6: Add responsive drawer and central-map styles**

Desktop uses a right-side drawer no wider than `360px`; mobile uses a bottom sheet no taller than `78dvh`. Keep route choices above the fold at 390×844 and retain clear focus outlines.

- [ ] **Step 7: Run map, drawer, and existing room tests**

Run: `npm test -- src/components/game/CampaignMap.test.tsx src/components/game/InventoryDrawer.test.tsx src/components/game/RunMap.test.tsx src/components/game/RoomOverlay.test.tsx`

Expected: PASS with the route inaccessible during active rooms.

- [ ] **Step 8: Commit the map and inventory UI**

```bash
git add src/components/game/CampaignMap.tsx src/components/game/CampaignMap.test.tsx src/components/game/InventoryDrawer.tsx src/components/game/InventoryDrawer.test.tsx src/components/game/RunMap.tsx src/components/game/CombatStage.tsx src/app/globals.css
git commit -m "feat: center campaign map and add inventory drawer"
```

## Task 9: Anchor fast attack dice above combatants

**Files:**
- Modify: `src/components/game/CombatDiceOverlay.tsx`
- Modify: `src/components/game/CombatDiceOverlay.test.tsx`
- Modify: `src/components/game/use-auto-combat.ts`
- Modify: `src/components/game/use-auto-combat.test.tsx`
- Modify: `src/components/game/PhaserBattle.tsx`
- Modify: `src/components/game/CombatStage.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing presentation and timing tests**

```tsx
it("renders one die above each combatant and no defense die", () => {
  render(<CombatDiceOverlay phase="presenting" guardianAttack={{ sides: 6, result: 4, critical: false }} invaderAttack={{ sides: 4, result: 2, critical: false }} />);
  expect(screen.getByLabelText("Ataque do Slime D6, resultado 4")).toHaveClass("combat-die-guardian");
  expect(screen.getByLabelText("Ataque do invasor D4, resultado 2")).toHaveClass("combat-die-invader");
  expect(screen.queryByText("Defesa")).toBeNull();
});

it("emphasizes only maximum-face criticals", () => {
  render(<CombatDiceOverlay phase="presenting" guardianAttack={{ sides: 6, result: 6, critical: true }} invaderAttack={{ sides: 4, result: 3, critical: false }} />);
  expect(screen.getByLabelText("Ataque do Slime D6, resultado 6, crítico")).toHaveClass("is-critical");
  expect(screen.getByLabelText("Ataque do invasor D4, resultado 3")).not.toHaveClass("is-critical");
});
```

- [ ] **Step 2: Run presentation tests and verify RED**

Run: `npm test -- src/components/game/CombatDiceOverlay.test.tsx src/components/game/use-auto-combat.test.tsx`

Expected: FAIL because three centered dice and slow defense intervention still exist.

- [ ] **Step 3: Reduce the combat state machine**

Use phases `rolling → resolving → presenting`. Normal timings are 220 ms, 120 ms, and 280 ms. Critical presentation lasts 700 ms. Remove defense reroll and its intervention timer. Preserve cleanup on encounter/outcome/unmount.

- [ ] **Step 4: Render separate anchor layers**

`CombatDiceOverlay` renders two compact dice in `.combat-die-anchor.guardian` and `.combat-die-anchor.invader`. `PhaserBattle` exposes matching DOM anchor containers over the canvas at the character positions. Use `aria-live="polite"` only for critical text to avoid announcing every animation verbosely.

- [ ] **Step 5: Add critical and reduced-motion styles**

Normal dice are 54–64 px, fade quickly, and never cover HP. `.is-critical` uses gold outline, glow, and a single scale pulse. Under reduced motion, replace movement with an opacity change and keep the longer readable duration.

- [ ] **Step 6: Run combat UI tests**

Run: `npm test -- src/components/game/CombatDiceOverlay.test.tsx src/components/game/use-auto-combat.test.tsx src/components/game/CombatStage.test.tsx`

Expected: PASS with two dice, no defense roll, correct critical class, and faster timers.

- [ ] **Step 7: Commit combat presentation**

```bash
git add src/components/game/CombatDiceOverlay.tsx src/components/game/CombatDiceOverlay.test.tsx src/components/game/use-auto-combat.ts src/components/game/use-auto-combat.test.tsx src/components/game/PhaserBattle.tsx src/components/game/CombatStage.tsx src/app/globals.css
git commit -m "feat: show fast overhead attack dice"
```

## Task 10: Add terminal run result screens

**Files:**
- Create: `src/components/game/RunResult.tsx`
- Create: `src/components/game/RunResult.test.tsx`
- Modify: `src/components/game/CombatStage.tsx`
- Modify: `src/components/game/use-preview-campaign.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing result tests**

```tsx
it("shows defeat progress and starts a clean run", async () => {
  const onRestart = vi.fn();
  render(<RunResult outcome="defeat" phaseIndex={4} completedRoomCount={21} evolutionName="Slime Fortaleza D10" onRestart={onRestart} />);
  expect(screen.getByRole("heading", { name: "A dungeon foi tomada" })).toBeVisible();
  expect(screen.getByText("Fase alcançada: 4/7")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Iniciar nova defesa" }));
  expect(onRestart).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run result tests and verify RED**

Run: `npm test -- src/components/game/RunResult.test.tsx`

Expected: FAIL because `RunResult` is missing.

- [ ] **Step 3: Implement victory and defeat variants**

Defeat title is `A dungeon foi tomada`; victory title is `Privatização revogada`. Both show phase, rooms, evolution, and one restart action. Do not expose seed, score internals, or hidden map content.

- [ ] **Step 4: Make terminal surfaces exclusive**

When `outcome !== "ongoing"`, `CombatStage` renders only `RunResult` plus the preview notice. The campaign controller clears combat timers, pending rooms, inventory drawer, and route actions before exposing the result surface.

- [ ] **Step 5: Run result and combat regression tests**

Run: `npm test -- src/components/game/RunResult.test.tsx src/components/game/CombatStage.test.tsx src/components/game/use-preview-campaign.test.tsx`

Expected: PASS; advancing timers after defeat causes no state changes.

- [ ] **Step 6: Commit terminal screens**

```bash
git add src/components/game/RunResult.tsx src/components/game/RunResult.test.tsx src/components/game/CombatStage.tsx src/components/game/use-preview-campaign.ts src/app/globals.css
git commit -m "feat: end runs with victory and defeat screens"
```

## Task 11: Harden APIs and run the complete verification matrix

**Files:**
- Modify: `tests/security/run-api.test.ts`
- Modify: `tests/integration/run-service.test.ts`
- Modify: `tools/hostinger-preview.test.mjs`
- Modify: `docs/deployment/hostinger.md`

- [ ] **Step 1: Add failing tamper and lifecycle tests**

Cover forged defense, forged critical, wrong equipment slot, duplicate equipment, use during combat, phase skip, post-defeat combat, post-victory reward, and repeated consumable command. Every public error assertion must also verify that the response omits seed and internal IDs.

```ts
expect(await postCommand({
  type: "EQUIP_ITEM",
  sequence: 9,
  commandId: "forge-slot-1",
  guardianId: "caretaker-slime",
  itemId: "reinforced-shield",
  slot: "weapon",
})).toMatchObject({ status: 400 });
```

- [ ] **Step 2: Run security tests and verify RED**

Run: `npm test -- tests/security/run-api.test.ts tests/integration/run-service.test.ts`

Expected: at least one new assertion FAILS before final schema/reducer hardening.

- [ ] **Step 3: Close validation gaps found by the tests**

Only edit command schemas, run persistence validation, reducer guards, and error redaction required by the failing cases. Do not trust client-supplied slot, bonus, defense, attack, critical, phase, or outcome values.

- [ ] **Step 4: Verify unit, integration, static preview, and production builds**

Run in order:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run build:hostinger
npm run test:hostinger
git diff --check
```

Expected: all commands exit 0; no warnings from React tests; Hostinger output includes the central map, inventory drawer, and terminal result assets.

- [ ] **Step 5: Perform browser playtests**

Use `game-studio:game-playtest` and `build-web-apps:frontend-testing-debugging` against the local production build. Verify desktop 1280×720 and mobile 390×844 for:

1. two or three route choices;
2. map returning after rooms;
3. inventory equip/unequip only on map;
4. equipped-only bonuses;
5. two small overhead dice;
6. critical emphasis only on maximum values;
7. immediate terminal defeat;
8. phase transition through all seven configured maps;
9. no console errors, horizontal overflow, or blocked controls.

- [ ] **Step 6: Update deployment documentation**

Document the seven-phase preview, temporary art status, authoritative production requirements, and the limitation that local preview state is not eligible for ranking submission.

- [ ] **Step 7: Commit verification coverage**

```bash
git add tests/security/run-api.test.ts tests/integration/run-service.test.ts tools/hostinger-preview.test.mjs docs/deployment/hostinger.md
git commit -m "test: verify dungeon guardian campaign security"
```

## Task 12: Publish and validate Hostinger preview

**Files:**
- No source files expected after Task 11 verification.

- [ ] **Step 1: Push the feature branch**

Run: `git push origin feature/dice-invoker-vertical-slice`

Expected: push succeeds and triggers the existing Hostinger deployment workflow.

- [ ] **Step 2: Monitor the deployment workflow**

Run: `gh run list --workflow publish-hostinger.yml --branch feature/dice-invoker-vertical-slice --limit 1`

Expected: the newest workflow completes with `success` for the final commit SHA.

- [ ] **Step 3: Smoke-test the live temporary domain**

Open `https://saddlebrown-louse-542936.hostingersite.com/`, bypass caches with a unique query string, and verify the deployed build fingerprint plus the nine browser checks from Task 11.

- [ ] **Step 4: Record deployment evidence**

Report the live URL, workflow run URL, commit SHA, automated test counts, desktop/mobile checks, and any explicitly deferred art work.
