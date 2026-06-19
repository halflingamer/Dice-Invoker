# Controlled Routes, Auto Combat, and Hero Evolution Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a playable ten-stage run with a branching map of pre-rolled Location Dice, controlled deterministic randomness, server-authoritative automatic combat, and an in-run Squire class tree progressing from D4 toward D12.

**Architecture:** Keep generation and combat as pure deterministic engine modules. Persist the complete authoritative run state in the existing `Run.stateJson`, and accept only intent commands through the current sequenced/idempotent command API. The React/Phaser layer presents server-confirmed state and schedules automatic turn commands; the Hostinger static build uses an explicitly labeled local demo adapter and remains isolated from rankings.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, Phaser 4, Prisma/PostgreSQL, Playwright, Tailwind/CSS.

---

## Task 1: Create independent deterministic random streams

**Files:**
- Modify: `src/modules/game-engine/rng.ts`
- Modify: `src/modules/game-engine/rng.test.ts`

**Step 1: Write failing channel-isolation tests**

Add tests proving that `createNamedRollStream(seed, "map")` is deterministic, differs from `"combat"`, and that advancing combat does not advance map results. Add validation tests for empty or malformed channel names.

**Step 2: Run the focused test and confirm failure**

Run: `npm test -- src/modules/game-engine/rng.test.ts`

Expected: FAIL because named streams do not exist.

**Step 3: Implement named streams**

Derive a channel seed with HMAC-SHA256 and delegate rolling to the existing unbiased `createRollStream`. Keep channel names restricted to a small internal union: `map`, `encounter`, `combat`, `reward`, and `event`.

**Step 4: Re-run the focused test**

Run: `npm test -- src/modules/game-engine/rng.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/modules/game-engine/rng.ts src/modules/game-engine/rng.test.ts
git commit -m "feat: isolate deterministic run random streams"
```

## Task 2: Replace the map generator with connected Location Dice routes

**Files:**
- Modify: `src/modules/game-engine/map.ts`
- Modify: `src/modules/game-engine/map.test.ts`
- Create: `src/modules/game-engine/map-simulation.test.ts`

**Step 1: Write failing topology tests**

Specify ten layers, widths of two or three except for the single final boss, unique node IDs, partial next-layer connections, no dead ends, and reachability of every generated node. Assert that no non-boss layer index has a fixed room type across a sample of seeds.

**Step 2: Write failing fairness/property tests**

Enumerate every complete path for at least 5,000 deterministic seeds and assert:

- exactly one boss, at the end;
- no consecutive elites;
- no three identical room types in sequence;
- at least one recovery opportunity on every path;
- different reachable choices at a fork whenever the bag can provide them;
- stable output for identical seed and content version.

**Step 3: Run tests and confirm failure**

Run: `npm test -- src/modules/game-engine/map.test.ts src/modules/game-engine/map-simulation.test.ts`

Expected: FAIL because the existing generator connects every node to every following node and uses independent rolls.

**Step 4: Implement topology generation**

Generate two-to-three-node layers and sparse crossing connections. Build forward and backward so every node has at least one incoming and outgoing edge where applicable. Add a deterministic bounded fallback topology.

**Step 5: Implement weighted shuffle-bag assignment**

Use a versioned room bag with combat dominant, event common, recovery rooms uncommon, and elite rare. Validate complete paths after assignment; retry with the same map stream up to a fixed limit and then apply a deterministic valid fallback. Store the rolled room symbol/type directly on each node.

**Step 6: Run tests and inspect simulation distribution**

Run: `npm test -- src/modules/game-engine/map.test.ts src/modules/game-engine/map-simulation.test.ts`

Expected: PASS within a practical runtime, with diagnostic distribution output only on failure.

**Step 7: Commit**

```bash
git add src/modules/game-engine/map.ts src/modules/game-engine/map.test.ts src/modules/game-engine/map-simulation.test.ts
git commit -m "feat: generate balanced branching location dice maps"
```

## Task 3: Model class dice and the Squire progression tree

**Files:**
- Modify: `src/modules/content/schema.ts`
- Modify: `src/modules/content/season-1.ts`
- Modify: `src/modules/content/content-loader.test.ts`
- Create: `src/modules/game-engine/progression.ts`
- Create: `src/modules/game-engine/progression.test.ts`

**Step 1: Write failing content-validation tests**

Require every class stage to have an ID, display name, die sides in `4 | 6 | 8 | 10 | 12`, exact face count, XP threshold, zero or two next-stage IDs, AI role weights, and valid effects. Reject cycles, missing children, skipped die sizes, and multiple roots for one hero.

**Step 2: Write failing progression tests**

Cover XP awards, threshold crossing, exactly two promotion offers, no promotion during unresolved combat, invalid class choices, D12 terminal behavior, and full reset on a new run.

**Step 3: Run focused tests and confirm failure**

Run: `npm test -- src/modules/content/content-loader.test.ts src/modules/game-engine/progression.test.ts`

Expected: FAIL because class stages and XP do not exist.

**Step 4: Extend the content schema**

Add class-die stage schemas and hero root-stage references. Keep equipped attack/defense/magic dice separate from the class die. Validate the whole graph in the content loader.

**Step 5: Add the first Squire tree**

Implement Escudeiro D4, Guerreiro/Guardião D6, Duelista/Cavaleiro/Paladino/Bastião D8, and coherent D10/D12 continuations. Each promotion preserves identity while adding or upgrading faces. Mark numbers as season-versioned tuning data.

**Step 6: Implement pure XP and promotion helpers**

Expose functions to award journey/type XP, detect promotion, return legal choices, and apply a choice without mutating input.

**Step 7: Re-run focused tests**

Run: `npm test -- src/modules/content/content-loader.test.ts src/modules/game-engine/progression.test.ts`

Expected: PASS.

**Step 8: Commit**

```bash
git add src/modules/content/schema.ts src/modules/content/season-1.ts src/modules/content/content-loader.test.ts src/modules/game-engine/progression.ts src/modules/game-engine/progression.test.ts
git commit -m "feat: add in-run class die progression"
```

## Task 4: Persist the authoritative map and progression state

**Files:**
- Modify: `src/modules/run/state.ts`
- Modify: `src/modules/run/create-run.ts`
- Modify: `src/modules/run/reducer.test.ts`

**Step 1: Write failing run-creation tests**

Assert that a new run contains its generated map, starts before the first choice, exposes only valid first-layer nodes, starts as Squire D4 with zero XP, and stores independent random cursors.

**Step 2: Run focused tests and confirm failure**

Run: `npm test -- src/modules/run/reducer.test.ts`

Expected: FAIL because the current state has one cursor, no map, and begins in combat.

**Step 3: Extend `RunState`**

Add versioned map snapshot, visited node IDs, current layer, named RNG cursors, combat turn state, XP, current class-stage ID, promotion choices, and timestamps required for the intervention window. Add `map-reveal`, `room-choice`, `combat-rolling`, `combat-intervention`, `combat-resolving`, and `promotion` phases.

**Step 4: Generate initial state on the server**

`createRun` must derive the map and streams from the decrypted server seed, expose only legal first nodes, and never accept client-supplied map or XP values.

**Step 5: Re-run focused tests**

Run: `npm test -- src/modules/run/reducer.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/modules/run/state.ts src/modules/run/create-run.ts src/modules/run/reducer.test.ts
git commit -m "feat: initialize authoritative map and class state"
```

## Task 5: Add secure route selection and promotion commands

**Files:**
- Modify: `src/modules/run/command-schema.ts`
- Modify: `src/modules/run/reducer.ts`
- Modify: `src/modules/run/reducer.test.ts`
- Modify: `src/modules/run/run-command-handler.ts`

**Step 1: Write failing command-abuse tests**

Cover selecting an unreachable node, revisiting a node, skipping a layer, selecting the boss early, forging XP/class IDs, promoting outside `promotion`, replaying a promotion, unknown fields, stale sequence, and oversized IDs.

**Step 2: Run focused tests and confirm failure**

Run: `npm test -- src/modules/run/reducer.test.ts`

Expected: FAIL for the new route and promotion behavior.

**Step 3: Add intent-only commands**

Keep `CHOOSE_ROOM`; add strict `ACKNOWLEDGE_MAP_REVEAL` and `CHOOSE_PROMOTION`. Payloads contain only official IDs and sequence. Do not accept XP, die sides, route availability, timestamps, results, or score.

**Step 4: Apply graph and class validation in the reducer**

Compute reachable nodes from the stored official graph. Resolve the selected room type server-side. Apply only a promotion offered in current state. Return conflict-safe error categories without leaking seed or internal rules.

**Step 5: Re-run focused tests**

Run: `npm test -- src/modules/run/reducer.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/modules/run/command-schema.ts src/modules/run/reducer.ts src/modules/run/reducer.test.ts src/modules/run/run-command-handler.ts
git commit -m "feat: validate route and promotion commands"
```

## Task 6: Orchestrate authoritative automatic combat turns

**Files:**
- Modify: `src/modules/game-engine/types.ts`
- Modify: `src/modules/game-engine/combat.ts`
- Modify: `src/modules/game-engine/combat.test.ts`
- Modify: `src/modules/run/command-schema.ts`
- Modify: `src/modules/run/reducer.ts`
- Modify: `src/modules/run/reducer.test.ts`

**Step 1: Write failing combat-roll tests**

Specify class-stage damage/defense rolls, equipment modifiers, deterministic enemy actions, victory-before-enemy-action, and no client-controlled numeric results.

**Step 2: Write failing timing/security tests**

Add `BEGIN_COMBAT_TURN`, `REROLL_COMBAT_DIE`, and `RESOLVE_COMBAT_TURN` intent tests. Verify one reroll costs essence once, only official rerollable dice are accepted, resolve cannot happen before the server deadline, reroll cannot happen after it, and replayed commands cannot duplicate damage or XP.

Inject `now()` into pure reducer dependencies or pass a server-owned command context; never trust a client timestamp.

**Step 3: Run focused tests and confirm failure**

Run: `npm test -- src/modules/game-engine/combat.test.ts src/modules/run/reducer.test.ts`

Expected: FAIL because orchestration and deadlines do not exist.

**Step 4: Implement turn generation and resolution**

Use only the `combat` stream to roll server-confirmed damage and defense results. Store the intervention deadline and pending results. Resolve them once, update HP/outcome, then transition to the next turn, reward, promotion, room choice, victory, or defeat.

**Step 5: Award XP after room resolution**

Use journey XP for every completed room plus type bonuses. If a threshold is crossed, finish the room first and enter `promotion`. Preserve pending next-room options until promotion completes.

**Step 6: Re-run focused tests**

Run: `npm test -- src/modules/game-engine/combat.test.ts src/modules/run/reducer.test.ts`

Expected: PASS.

**Step 7: Commit**

```bash
git add src/modules/game-engine/types.ts src/modules/game-engine/combat.ts src/modules/game-engine/combat.test.ts src/modules/run/command-schema.ts src/modules/run/reducer.ts src/modules/run/reducer.test.ts
git commit -m "feat: orchestrate automatic authoritative combat"
```

## Task 7: Harden persistence and command execution

**Files:**
- Modify: `src/modules/run/run-service.ts`
- Modify: `src/modules/run/run-service-instance.ts`
- Modify: `src/modules/run/run-command-handler.ts`
- Create or modify: `src/modules/run/run-service.test.ts`
- Modify: `src/modules/security/rate-limit.ts`

**Step 1: Write failing concurrency and expiry tests**

Cover simultaneous resolve commands, idempotency-key replay, stale run version, expired intervention action, ownership mismatch, excessive auto-turn requests, and state/command atomicity.

**Step 2: Run focused tests and confirm failure**

Run: `npm test -- src/modules/run/run-service.test.ts`

Expected: FAIL for missing cases.

**Step 3: Make execution atomic**

Persist state and command response in one Prisma transaction guarded by run version and sequence. Return the stored response for repeated idempotency keys. Rate-limit by user, run, and command class; automatic turn progression receives a narrow allowance without weakening other commands.

**Step 4: Redact operational errors**

Log correlation ID and safe metadata, but never seed plaintext, full session data, or unreduced command payloads. Return stable public errors.

**Step 5: Re-run focused tests**

Run: `npm test -- src/modules/run/run-service.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/modules/run/run-service.ts src/modules/run/run-service-instance.ts src/modules/run/run-command-handler.ts src/modules/run/run-service.test.ts src/modules/security/rate-limit.ts
git commit -m "fix: harden automatic run command execution"
```

## Task 8: Build the interactive Location Dice map

**Files:**
- Modify: `src/components/game/RunMap.tsx`
- Create: `src/components/game/LocationDie.tsx`
- Create: `src/components/game/RunMap.test.tsx`
- Modify: `src/app/globals.css`

**Step 1: Write failing UI tests**

Render a sample graph and assert symbols, connecting lines, accessible names, reachable/selected/completed/lost/locked states, disabled unreachable nodes, and room-selection callback behavior. Add a reduced-motion case.

**Step 2: Run focused tests and confirm failure**

Run: `npm test -- src/components/game/RunMap.test.tsx`

Expected: FAIL because the current map is a static numbered column.

**Step 3: Implement the graph UI**

Render branches with an SVG connection layer and semantic buttons for Location Dice. Animate the initial settled roll without changing confirmed faces. Keep symbols plus text/ARIA labels so room information is not color-only.

**Step 4: Add responsive styles**

Desktop uses a vertical route panel; mobile opens the map as a scrollable full-width stage between rooms. Preserve the playfield during combat and honor `prefers-reduced-motion`.

**Step 5: Re-run focused tests**

Run: `npm test -- src/components/game/RunMap.test.tsx`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/components/game/RunMap.tsx src/components/game/LocationDie.tsx src/components/game/RunMap.test.tsx src/app/globals.css
git commit -m "feat: render branching location dice map"
```

## Task 9: Present automatic dice turns and promotion choices

**Files:**
- Modify: `src/components/game/CombatStage.tsx`
- Modify: `src/components/game/DiceTray.tsx`
- Create: `src/components/game/CombatDiceOverlay.tsx`
- Create: `src/components/game/PromotionChoice.tsx`
- Create: `src/components/game/use-auto-combat.ts`
- Modify: `src/components/game/use-run-command.ts`
- Modify: `src/components/game/CombatStage.test.tsx`
- Create: `src/components/game/PromotionChoice.test.tsx`
- Modify: `src/app/globals.css`

**Step 1: Write failing interaction tests**

Use fake timers to prove that confirmed damage/defense dice appear, settle, expose a short reroll window, resolve automatically without input, disappear after presentation, stop scheduling on unmount/state change, and never derive a result with `Math.random()`.

Test that promotion blocks map continuation and submits only the chosen official class ID.

**Step 2: Run focused tests and confirm failure**

Run: `npm test -- src/components/game/CombatStage.test.tsx src/components/game/PromotionChoice.test.tsx`

Expected: FAIL because combat is manually activated and promotion UI does not exist.

**Step 3: Implement the auto-combat controller**

Schedule intent commands from authoritative phase/deadline state. Abort stale requests and timers. On reconnect, fetch current run state and continue from the server phase instead of replaying local animation history.

**Step 4: Implement dice presentation**

Show only current damage and defense dice over the arena, animate entrance/roll/settle/exit, and expose a one-click essence reroll during `intervention`. Remove manual `Ativar` and persistent locking from the main combat flow.

**Step 5: Implement promotion UI**

Compare the two class choices by die size, new/upgraded faces, tactical role, and principal synergies. Include keyboard focus management and reduced-motion behavior.

**Step 6: Re-run focused tests**

Run: `npm test -- src/components/game/CombatStage.test.tsx src/components/game/PromotionChoice.test.tsx`

Expected: PASS.

**Step 7: Commit**

```bash
git add src/components/game/CombatStage.tsx src/components/game/DiceTray.tsx src/components/game/CombatDiceOverlay.tsx src/components/game/PromotionChoice.tsx src/components/game/use-auto-combat.ts src/components/game/use-run-command.ts src/components/game/CombatStage.test.tsx src/components/game/PromotionChoice.test.tsx src/app/globals.css
git commit -m "feat: animate automatic combat and promotions"
```

## Task 10: Keep the Hostinger preview playable and safely isolated

**Files:**
- Create: `src/components/game/preview-run-adapter.ts`
- Create: `src/components/game/preview-run-adapter.test.ts`
- Modify: `src/components/game/CombatStage.tsx`
- Modify: `tools/hostinger-preview.test.mjs`
- Modify: `docs/deployment/hostinger.md`

**Step 1: Write failing preview-isolation tests**

Assert that the static adapter runs a fixed local demonstration seed, uses no ranking/auth API, cannot submit a score, and is selected only when `NEXT_PUBLIC_HOSTINGER_PREVIEW=1`. Verify the built bundle has no secret seed, database URL, or server route payload.

**Step 2: Run focused tests and confirm failure**

Run: `npm test -- src/components/game/preview-run-adapter.test.ts && npm run test:hostinger`

Expected: FAIL because the new adapter does not exist.

**Step 3: Implement the demo adapter**

Mirror the authoritative state shape locally for presentation only. Keep the visible “Prévia de demonstração” notice and disable all competitive persistence.

**Step 4: Build and test the static package**

Run: `npm run build:hostinger && npm run test:hostinger`

Expected: PASS and a safe static archive in `dist/`.

**Step 5: Commit**

```bash
git add src/components/game/preview-run-adapter.ts src/components/game/preview-run-adapter.test.ts src/components/game/CombatStage.tsx tools/hostinger-preview.test.mjs docs/deployment/hostinger.md
git commit -m "feat: add isolated route and combat preview"
```

## Task 11: Full verification and browser playtest

**Files:**
- Create or modify: `e2e/run-flow.spec.ts`
- Modify only if verification finds defects: files from prior tasks

**Step 1: Add the end-to-end run slice**

Cover initial map reveal, choosing a reachable Location Die, automatic combat, essence reroll, XP gain, a class promotion, returning to the map, mobile layout, and keyboard navigation. In test mode, use controlled server time rather than sleeping through real deadlines.

**Step 2: Run the complete local verification suite**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run build:hostinger
npm run test:hostinger
```

Expected: all commands PASS. Record any unrelated pre-existing warning separately; do not hide it.

**Step 3: Run security-focused regression checks**

Verify forged room/class/result/XP/score fields are rejected, sequence and idempotency controls hold, seed plaintext is absent from responses/logs/static output, CSP/security headers remain active, and API paths are absent from the Hostinger package.

**Step 4: Playtest in the browser**

Inspect desktop and mobile screenshots, connection readability, symbol clarity, dice timing, reduced motion, promotion comparison, and combat/map transitions. Confirm the live Hostinger preview only after the branch workflow deploys successfully.

**Step 5: Commit verification coverage and any fixes**

```bash
git add e2e/run-flow.spec.ts
git commit -m "test: verify routes combat and progression flow"
```

## Task 12: Publish for review

**Files:**
- No new product files expected

**Step 1: Inspect the final diff and history**

Run: `git status --short && git log --oneline --decorate -15`

Expected: clean working tree and intentional task commits.

**Step 2: Push the feature branch**

Run: `git push origin feature/dice-invoker-vertical-slice`

Expected: branch updates successfully and the Hostinger publication workflow passes.

**Step 3: Re-run live smoke checks**

Open the temporary Hostinger domain, complete at least one branch choice and one automatic combat turn, and verify security headers plus blocked sensitive/API paths.

