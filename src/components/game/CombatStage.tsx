"use client";

import { Fragment, useState } from "react";
import { CombatDiceOverlay } from "./CombatDiceOverlay";
import { EssenceMeter } from "./EssenceMeter";
import { HeroSheet } from "./HeroSheet";
import { PhaserBattle, type BattleAnimationEvent } from "./PhaserBattle";
import { PromotionChoice } from "./PromotionChoice";
import { RunMap } from "./RunMap";
import { previewRunMap } from "./preview-run-adapter";
import { useAutoCombat } from "./use-auto-combat";
import type { RunMap as RunMapModel, RoomType } from "@/modules/game-engine/map";

const COMBAT_TYPES = new Set<RoomType>(["combat", "elite", "boss"]);
const ENEMY_HP: Record<"combat" | "elite" | "boss", number> = { combat: 18, elite: 28, boss: 64 };
const ENEMY_NAME: Record<"combat" | "elite" | "boss", string> = {
  combat: "Slime de Recibo",
  elite: "Inspetor Gelatinoso",
  boss: "Supervisor Gelatinoso",
};

export function CombatStage({ initialMap = previewRunMap }: Readonly<{ initialMap?: RunMapModel }>) {
  const [route, setRoute] = useState(() => ({
    availableRoomIds: initialMap.layers[0]!.nodes.map((node) => node.id),
    visitedRoomIds: [] as string[],
    currentRoomId: null as string | null,
  }));
  const [pendingNextIds, setPendingNextIds] = useState<readonly string[]>([]);
  const [combatActive, setCombatActive] = useState(false);
  const [enemyMaxHp, setEnemyMaxHp] = useState(18);
  const [enemyName, setEnemyName] = useState("Aguardando destino");
  const [enemyRank, setEnemyRank] = useState<"normal" | "elite" | "boss">("normal");
  const [heroHp, setHeroHp] = useState(24);
  const [classSides, setClassSides] = useState<4 | 6>(4);
  const [className, setClassName] = useState("Escudeiro");
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [event, setEvent] = useState<BattleAnimationEvent | null>(null);
  const [message, setMessage] = useState("Escolha um Dado de Local alcançável.");
  const isHostingerPreview = process.env.NEXT_PUBLIC_HOSTINGER_PREVIEW === "1";

  const finishCombat = () => {
    setCombatActive(false);
    setEvent({ id: Date.now(), type: "hit" });
    setMessage("Vitória! Experiência da sala recebida.");
    if (classSides === 4) {
      setPromotionOpen(true);
      return;
    }
    setRoute((current) => ({ ...current, availableRoomIds: [...pendingNextIds] }));
  };

  const combat = useAutoCombat({
    encounterId: combatActive ? route.currentRoomId : null,
    initialEnemyHp: enemyMaxHp,
    initialHeroHp: heroHp,
    sides: classSides,
    enemyRank,
    onHeroHpChange: setHeroHp,
    onVictory: finishCombat,
  });

  const chooseRoom = (roomId: string) => {
    if (!route.availableRoomIds.includes(roomId)) return;
    const node = initialMap.layers.flatMap((layer) => layer.nodes).find((candidate) => candidate.id === roomId);
    if (!node) return;
    const isCombat = COMBAT_TYPES.has(node.type);
    setPendingNextIds(node.nextNodeIds);
    setRoute((current) => ({
      currentRoomId: roomId,
      visitedRoomIds: [...current.visitedRoomIds, roomId],
      availableRoomIds: isCombat ? [] : [...node.nextNodeIds],
    }));
    if (isCombat) {
      const rank = node.type as "combat" | "elite" | "boss";
      setEnemyMaxHp(ENEMY_HP[rank]);
      setEnemyName(ENEMY_NAME[rank]);
      setEnemyRank(rank === "combat" ? "normal" : rank);
      setCombatActive(true);
      setMessage("Os dados de dano e defesa foram invocados.");
    } else {
      setMessage(`Local resolvido: ${node.type}. Experiência de jornada recebida.`);
    }
  };

  const reroll = (kind: "damage" | "defense") => {
    combat.reroll(kind);
    setEvent({ id: Date.now(), type: "reroll" });
  };

  const choosePromotion = (stageId: string) => {
    const guardian = stageId === "guardian-d6";
    setClassSides(6);
    setClassName(guardian ? "Guardião" : "Guerreiro");
    setPromotionOpen(false);
    setRoute((current) => ({ ...current, availableRoomIds: [...pendingNextIds] }));
    setMessage(`${guardian ? "Guardião" : "Guerreiro"} D6 desbloqueado nesta run.`);
  };

  const phaseMessage = combat.phase === "rolling"
    ? "Dados em movimento…"
    : combat.phase === "intervention"
      ? "Você pode gastar essência antes da resolução."
      : combat.phase === "resolving"
        ? "Resolvendo dano e defesa…"
        : combat.phase === "presenting"
          ? combat.message
          : message;

  return (
    <Fragment>
      {isHostingerPreview ? (
        <div className="preview-notice" role="status" aria-label="Prévia Hostinger">
          <strong>Prévia de demonstração</strong> — funciona localmente e não envia pontuação ao ranking.
        </div>
      ) : null}
      <main className="game-shell">
        <HeroSheet />
        <section className="battle-column">
          <header className="combat-header">
            <div><b>{className} D{classSides}</b><span>♥ {combat.heroHp}/24</span></div>
            <div className="room-progress"><b>Sala {route.visitedRoomIds.length}/10</b><span>XP da run · evolução temporária</span></div>
            <div className="enemy"><b>{enemyName}</b><span>♥ {combat.enemyHp}/{enemyMaxHp}</span></div>
          </header>
          <PhaserBattle event={event} />
          {combat.phase !== "idle" ? (
            <CombatDiceOverlay
              phase={combat.phase}
              damage={combat.damage}
              defense={combat.defense}
              enemyAttack={combat.enemyAttack}
              essence={combat.essence}
              onReroll={reroll}
            />
          ) : null}
          <div className="status-line" aria-live="polite">
            {phaseMessage}<EssenceMeter value={combat.essence} max={2} />
          </div>
        </section>
        <RunMap
          map={initialMap}
          availableRoomIds={route.availableRoomIds}
          visitedRoomIds={route.visitedRoomIds}
          currentRoomId={route.currentRoomId}
          onChoose={chooseRoom}
        />
      </main>
      {promotionOpen ? (
        <PromotionChoice
          currentDie="D4"
          options={[
            { id: "warrior-d6", name: "Guerreiro", die: "D6", role: "Ataque", summary: "Faces ofensivas e decisões agressivas." },
            { id: "guardian-d6", name: "Guardião", die: "D6", role: "Defesa", summary: "Bloqueio, proteção e contra-ataque." },
          ]}
          onChoose={choosePromotion}
        />
      ) : null}
    </Fragment>
  );
}
