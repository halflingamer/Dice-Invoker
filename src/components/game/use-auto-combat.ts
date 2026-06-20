"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CombatDieKind, CombatDieResult } from "@/modules/game-engine/types";
import { resolveCombatExchange } from "@/modules/game-engine/combat";
import type { CombatPresentationPhase, EnemyAttackDie } from "./CombatDiceOverlay";

type AutoCombatPhase = CombatPresentationPhase | "idle";
type ClassDieSides = 4 | 6 | 8 | 10 | 12;
type EnemyRank = "normal" | "elite" | "boss";

function enemyAttackForTurn(turn: number, rank: EnemyRank): EnemyAttackDie {
  const sides = ({ normal: 4, elite: 6, boss: 8 } as const)[rank];
  return { sides, result: (turn * 5 % sides) + 1 };
}

function diceForTurn(turn: number, sides: ClassDieSides) {
  const damageFace = (turn * 2 % sides) + 1;
  const defenseFace = (turn * 3 % sides) + 1;
  return {
    damage: {
      kind: "damage",
      sides,
      faceIndex: damageFace,
      label: damageFace === sides ? "Golpe decisivo" : "Golpe",
      value: damageFace,
      healing: 0,
    } satisfies CombatDieResult,
    defense: {
      kind: "defense",
      sides,
      faceIndex: defenseFace,
      label: defenseFace === sides ? "Muralha" : "Aparar",
      value: defenseFace,
      healing: 0,
    } satisfies CombatDieResult,
  };
}

export function useAutoCombat({
  encounterId,
  initialEnemyHp,
  initialHeroHp = 24,
  sides,
  enemyRank = "normal",
  onHeroHpChange,
  onVictory,
}: Readonly<{
  encounterId: string | null;
  initialEnemyHp: number;
  initialHeroHp?: number;
  sides: ClassDieSides;
  enemyRank?: EnemyRank;
  onHeroHpChange?(heroHp: number): void;
  onVictory(): void;
}>) {
  const [phase, setPhase] = useState<AutoCombatPhase>(encounterId ? "rolling" : "idle");
  const [turn, setTurn] = useState(1);
  const [enemyHp, setEnemyHp] = useState(initialEnemyHp);
  const [heroHp, setHeroHp] = useState(initialHeroHp);
  const [essence, setEssence] = useState(2);
  const [won, setWon] = useState(false);
  const [dice, setDice] = useState(() => diceForTurn(1, sides));
  const [enemyAttack, setEnemyAttack] = useState(() => enemyAttackForTurn(1, enemyRank));
  const [message, setMessage] = useState("");
  const onVictoryRef = useRef(onVictory);
  const onHeroHpChangeRef = useRef(onHeroHpChange);
  const initialHeroHpRef = useRef(initialHeroHp);

  useEffect(() => { onVictoryRef.current = onVictory; }, [onVictory]);
  useEffect(() => { onHeroHpChangeRef.current = onHeroHpChange; }, [onHeroHpChange]);
  useEffect(() => { initialHeroHpRef.current = initialHeroHp; }, [initialHeroHp]);

  useEffect(() => {
    // A new encounter is a state-machine boundary: every combat resource must reset atomically.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTurn(1);
    setEnemyHp(initialEnemyHp);
    setHeroHp(initialHeroHpRef.current);
    setEssence(2);
    setWon(false);
    setDice(diceForTurn(1, sides));
    setEnemyAttack(enemyAttackForTurn(1, enemyRank));
    setMessage("");
    setPhase(encounterId ? "rolling" : "idle");
  }, [encounterId, enemyRank, initialEnemyHp, sides]);

  useEffect(() => {
    if (phase === "idle") return;
    let delay = 0;
    let next: AutoCombatPhase | null = null;
    if (phase === "rolling") {
      delay = 600;
      next = "intervention";
    } else if (phase === "intervention") {
      delay = 2_500;
      next = "resolving";
    } else if (phase === "resolving") {
      delay = 200;
    } else if (phase === "presenting") {
      delay = 600;
    }

    const timer = window.setTimeout(() => {
      if (next) {
        setPhase(next);
        return;
      }
      if (phase === "resolving") {
        const result = resolveCombatExchange({
          heroHp,
          enemyHp,
          heroDamage: dice.damage.value,
          heroDefense: dice.defense.value,
          enemyAttack: enemyAttack.result,
        });
        setEnemyHp(result.enemyHp);
        setHeroHp(result.heroHp);
        onHeroHpChangeRef.current?.(result.heroHp);
        setWon(result.victory);
        const blocked = result.victory ? 0 : Math.min(dice.defense.value, enemyAttack.result);
        setMessage(`Ataque causou ${result.damageDealt}; defesa bloqueou ${blocked}; recebeu ${result.damageTaken}.`);
        setPhase("presenting");
        return;
      }
      if (won) {
        setPhase("idle");
        onVictoryRef.current();
        return;
      }
      const nextTurn = turn + 1;
      setTurn(nextTurn);
      setDice(diceForTurn(nextTurn, sides));
      setEnemyAttack(enemyAttackForTurn(nextTurn, enemyRank));
      setPhase("rolling");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [dice.damage.value, dice.defense.value, enemyAttack.result, enemyHp, enemyRank, heroHp, phase, sides, turn, won]);

  const reroll = useCallback((kind: CombatDieKind) => {
    if (phase !== "intervention" || essence < 1) return;
    setEssence((current) => current - 1);
    setDice((current) => {
      const die = current[kind];
      const nextFace = die.faceIndex === die.sides ? 1 : die.faceIndex + 1;
      return {
        ...current,
        [kind]: {
          ...die,
          faceIndex: nextFace,
          value: nextFace,
          label: kind === "damage" ? "Destino alterado" : "Guarda alterada",
        },
      };
    });
  }, [essence, phase]);

  return { phase, turn, enemyHp, heroHp, essence, enemyAttack, message, ...dice, reroll };
}
