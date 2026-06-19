"use client";

import { Fragment, useState } from "react";
import { DiceTray, type DisplayDie } from "./DiceTray";
import { EssenceMeter } from "./EssenceMeter";
import { HeroSheet } from "./HeroSheet";
import { PhaserBattle, type BattleAnimationEvent } from "./PhaserBattle";
import { RunMap } from "./RunMap";
import { previewRunMap } from "./preview-run-adapter";
import type { RunMap as RunMapModel } from "@/modules/game-engine/map";

const initialDice: DisplayDie[] = [
  { id: "rusty-sword", name: "Espada Enferrujada", face: "Corte", value: 5, locked: false },
  { id: "wooden-shield", name: "Escudo de Madeira", face: "Aparar", value: 2, locked: false },
];

export function CombatStage({ initialMap = previewRunMap }: Readonly<{ initialMap?: RunMapModel }>) {
  const [dice, setDice] = useState(initialDice);
  const [essence, setEssence] = useState(2);
  const [enemyHp, setEnemyHp] = useState(18);
  const [event, setEvent] = useState<BattleAnimationEvent | null>(null);
  const [message, setMessage] = useState("Escolha o destino dos dados.");
  const [route, setRoute] = useState(() => ({
    availableRoomIds: initialMap.layers[0]!.nodes.map((node) => node.id),
    visitedRoomIds: [] as string[],
    currentRoomId: null as string | null,
  }));
  const isHostingerPreview = process.env.NEXT_PUBLIC_HOSTINGER_PREVIEW === "1";

  const animate = (type: BattleAnimationEvent["type"]) => setEvent({ id: Date.now(), type });
  const lock = (id: string) => {
    setDice((current) => current.map((die) => die.id === id ? { ...die, locked: true } : die));
    setMessage("Resultado travado.");
  };
  const reroll = () => {
    if (essence < 1) return;
    setEssence((value) => value - 1);
    setDice((current) => current.map((die) => die.locked ? die : {
      ...die,
      value: die.value === 6 ? 1 : die.value + 1,
      face: die.id === "rusty-sword" ? "Golpe" : "Firmar",
    }));
    animate("reroll");
    setMessage("O destino foi rerrolado.");
  };
  const activate = () => {
    const damage = dice.find((die) => die.id === "rusty-sword")?.value ?? 0;
    setEnemyHp((value) => Math.max(0, value - damage));
    animate("hit");
    setDice((current) => current.map((die) => ({ ...die, locked: false })));
    setMessage(enemyHp - damage <= 0
      ? "Slime derrotado! Recompensa liberada."
      : `Escudeiro causou ${damage} de dano.`);
  };
  const chooseRoom = (roomId: string) => {
    if (!route.availableRoomIds.includes(roomId)) return;
    const node = initialMap.layers.flatMap((layer) => layer.nodes).find((candidate) => candidate.id === roomId);
    if (!node) return;
    setRoute({
      currentRoomId: roomId,
      visitedRoomIds: [...route.visitedRoomIds, roomId],
      availableRoomIds: [...node.nextNodeIds],
    });
    setMessage(`Destino escolhido: ${node.type}.`);
  };

  return <Fragment>
    {isHostingerPreview ? <div className="preview-notice" role="status" aria-label="Prévia Hostinger">
      <strong>Prévia de demonstração</strong> — funciona localmente e não envia pontuação ao ranking.
    </div> : null}
    <main className="game-shell">
      <HeroSheet />
      <section className="battle-column">
        <header className="combat-header">
          <div><b>Escudeiro</b><span>♥ 28/40</span></div>
          <div className="room-progress"><b>Sala 3/10</b><span>● ● ● ○ ○ ○ ○ ○ ○ ○</span></div>
          <div className="enemy"><b>Slime de Recibo</b><span>♥ {enemyHp}/18</span></div>
        </header>
        <PhaserBattle event={event} />
        <div className="status-line" aria-live="polite">
          {message}<EssenceMeter value={essence} max={2} />
        </div>
        <DiceTray dice={dice} essence={essence} busy={false} onLock={lock} onReroll={reroll} onActivate={activate} />
      </section>
      <RunMap
        map={initialMap}
        availableRoomIds={route.availableRoomIds}
        visitedRoomIds={route.visitedRoomIds}
        currentRoomId={route.currentRoomId}
        onChoose={chooseRoom}
      />
    </main>
  </Fragment>;
}
