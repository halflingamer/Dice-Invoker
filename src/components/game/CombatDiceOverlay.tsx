"use client";

import type { CombatDieKind, CombatDieResult } from "@/modules/game-engine/types";

export type EnemyAttackDie = Readonly<{ sides: 4 | 6 | 8; result: number }>;

export type CombatPresentationPhase = "rolling" | "intervention" | "resolving" | "presenting";

function CombatDie({
  die,
  phase,
  canReroll,
  onReroll,
}: Readonly<{
  die: CombatDieResult;
  phase: CombatPresentationPhase;
  canReroll: boolean;
  onReroll(kind: CombatDieKind): void;
}>) {
  const title = die.kind === "damage" ? "Dano" : "Defesa";
  return (
    <article
      className={`combat-die combat-die-${die.kind} is-${phase}`}
      aria-label={`Dado de ${die.kind === "damage" ? "dano" : "defesa"} D${die.sides}, resultado ${die.value}`}
    >
      <small>{title} · D{die.sides}</small>
      <strong>{die.value}</strong>
      <span>{die.label}</span>
      {phase === "intervention" && canReroll ? (
        <button type="button" onClick={() => onReroll(die.kind)} aria-label={`Rerrolar ${die.kind === "damage" ? "dano" : "defesa"}`}>
          ↻ 1 essência
        </button>
      ) : null}
    </article>
  );
}

export function CombatDiceOverlay({
  phase,
  damage,
  defense,
  enemyAttack,
  essence,
  onReroll,
}: Readonly<{
  phase: CombatPresentationPhase;
  damage: CombatDieResult;
  defense: CombatDieResult;
  enemyAttack: EnemyAttackDie;
  essence: number;
  onReroll(kind: CombatDieKind): void;
}>) {
  return (
    <section className={`combat-dice-overlay is-${phase}`} aria-live="polite" aria-label="Dados de combate">
      <CombatDie die={damage} phase={phase} canReroll={essence > 0} onReroll={onReroll} />
      <CombatDie die={defense} phase={phase} canReroll={essence > 0} onReroll={onReroll} />
      <article
        className={`combat-die combat-die-enemy is-${phase}`}
        aria-label={`Dado de ataque inimigo D${enemyAttack.sides}, resultado ${enemyAttack.result}`}
      >
        <small>Ataque inimigo · D{enemyAttack.sides}</small>
        <strong>{enemyAttack.result}</strong>
        <span>Contra-ataque</span>
      </article>
    </section>
  );
}
