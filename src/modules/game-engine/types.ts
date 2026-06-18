export type CombatOutcome = "ongoing" | "victory" | "defeat";

export type TurnInput = Readonly<{
  heroHp: number;
  heroMaxHp: number;
  enemyHp: number;
  block: number;
  heroDamage: number;
  enemyDamage: number;
  healing: number;
}>;

export type TurnResult = Readonly<{
  heroHp: number;
  enemyHp: number;
  blockRemaining: number;
  outcome: CombatOutcome;
}>;
