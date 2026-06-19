export type CombatOutcome = "ongoing" | "victory" | "defeat";
export type CombatDieKind = "damage" | "defense";

export type CombatDieResult = Readonly<{
  kind: CombatDieKind;
  sides: 4 | 6 | 8 | 10 | 12;
  faceIndex: number;
  label: string;
  value: number;
  healing: number;
}>;

export type ClassCombatDice = Readonly<{
  damage: CombatDieResult;
  defense: CombatDieResult;
}>;

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
