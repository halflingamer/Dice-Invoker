export type CombatOutcome = "ongoing" | "victory" | "defeat";
export type CombatDieSides = 4 | 6 | 8 | 10 | 12 | 20;

export type AttackRoll = Readonly<{
  sides: CombatDieSides;
  result: number;
  critical: boolean;
}>;
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

export type CombatExchangeInput = Readonly<{
  guardianHp: number;
  invaderHp: number;
  guardianAttack: number;
  guardianDefense: number;
  invaderAttack: number;
  invaderDefense: number;
}>;

export type CombatExchangeResult = Readonly<{
  guardianHp: number;
  invaderHp: number;
  damageDealt: number;
  damageTaken: number;
  victory: boolean;
  defeat: boolean;
}>;

/** @deprecated Use CombatExchangeInput. */
export type LegacyCombatExchangeInput = Readonly<{
  heroHp: number;
  enemyHp: number;
  heroDamage: number;
  heroDefense: number;
  enemyAttack: number;
}>;

/** @deprecated Use CombatExchangeResult. */
export type LegacyCombatExchangeResult = Readonly<{
  heroHp: number;
  enemyHp: number;
  damageDealt: number;
  damageTaken: number;
  victory: boolean;
  defeat: boolean;
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
