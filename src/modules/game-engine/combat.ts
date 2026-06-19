import type { ClassStage } from "@/modules/content/schema";
import type { ClassCombatDice, CombatDieKind, CombatDieResult, TurnInput, TurnResult } from "./types";

export function rollClassCombatDie(
  stage: ClassStage,
  kind: CombatDieKind,
  roll: (sides: number) => number,
): CombatDieResult {
  const faceIndex = roll(stage.sides);
  if (!Number.isSafeInteger(faceIndex) || faceIndex < 1 || faceIndex > stage.sides) {
    throw new Error("class die roll is outside its faces");
  }
  const face = stage.faces[faceIndex - 1]!;
  return {
    kind,
    sides: stage.sides,
    faceIndex,
    label: face.label,
    value: kind === "damage" ? face.damage : face.block,
    healing: face.healing,
  };
}

export function rollClassCombatDice(
  stage: ClassStage,
  roll: (sides: number) => number,
): ClassCombatDice {
  return {
    damage: rollClassCombatDie(stage, "damage", roll),
    defense: rollClassCombatDie(stage, "defense", roll),
  };
}

function assertNonNegativeInteger(label: string, value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

export function resolveTurn(input: TurnInput): TurnResult {
  for (const [label, value] of Object.entries(input)) {
    assertNonNegativeInteger(label, value);
  }
  if (input.heroMaxHp === 0 || input.heroHp > input.heroMaxHp) {
    throw new Error("heroHp must be within heroMaxHp");
  }

  const enemyHp = Math.max(0, input.enemyHp - input.heroDamage);
  if (enemyHp === 0) {
    return {
      heroHp: Math.min(input.heroMaxHp, input.heroHp + input.healing),
      enemyHp,
      blockRemaining: input.block,
      outcome: "victory",
    };
  }

  const healedHp = Math.min(input.heroMaxHp, input.heroHp + input.healing);
  const absorbedDamage = Math.min(input.block, input.enemyDamage);
  const blockRemaining = input.block - absorbedDamage;
  const incomingDamage = input.enemyDamage - absorbedDamage;
  const heroHp = Math.max(0, healedHp - incomingDamage);

  return {
    heroHp,
    enemyHp,
    blockRemaining,
    outcome: heroHp === 0 ? "defeat" : "ongoing",
  };
}
