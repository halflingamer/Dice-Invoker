import type { TurnInput, TurnResult } from "./types";

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
