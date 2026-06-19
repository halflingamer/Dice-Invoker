"use client";

import type { CombatDieKind, CombatDieResult } from "@/modules/game-engine/types";

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
  essence,
  onReroll,
}: Readonly<{
  phase: CombatPresentationPhase;
  damage: CombatDieResult;
  defense: CombatDieResult;
  essence: number;
  onReroll(kind: CombatDieKind): void;
}>) {
  return (
    <section className={`combat-dice-overlay is-${phase}`} aria-live="polite" aria-label="Dados de combate">
      <CombatDie die={damage} phase={phase} canReroll={essence > 0} onReroll={onReroll} />
      <CombatDie die={defense} phase={phase} canReroll={essence > 0} onReroll={onReroll} />
    </section>
  );
}
