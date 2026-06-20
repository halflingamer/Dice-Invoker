"use client";

import { Fragment, useState } from "react";
import { seasonOne } from "@/modules/content/season-1";
import { purchaseLegacyItem, RUN_ITEMS, type RunItemId } from "@/modules/game-engine/economy";
import { createEventOffer, resolveEventChoice, type EventChoiceResult, type EventOffer } from "@/modules/game-engine/events";
import type { RunMap as RunMapModel, RoomType } from "@/modules/game-engine/map";
import {
  chooseMerchantItem,
  chooseTreasureReward,
  createMerchantOffer,
  createTreasureOffer,
  type MerchantOffer,
  type TreasureOffer,
} from "@/modules/game-engine/rewards";
import { CombatDiceOverlay } from "./CombatDiceOverlay";
import { EssenceMeter } from "./EssenceMeter";
import { EventRoom } from "./EventRoom";
import { HeroSheet } from "./HeroSheet";
import { MerchantRoom } from "./MerchantRoom";
import { PhaserBattle, type BattleAnimationEvent } from "./PhaserBattle";
import { PromotionChoice } from "./PromotionChoice";
import { RunMap } from "./RunMap";
import { TreasureRoom } from "./TreasureRoom";
import { previewRunMap } from "./preview-run-adapter";
import { useAutoCombat } from "./use-auto-combat";

const COMBAT_TYPES = new Set<RoomType>(["combat", "elite", "boss"]);
const ENEMY_HP = { combat: 18, elite: 28, boss: 64 } as const;
const ENEMY_NAME = {
  combat: "Slime de Recibo",
  elite: "Inspetor Gelatinoso",
  boss: "Supervisor Gelatinoso",
} as const;
const COMBAT_GOLD = { normal: 3, elite: 7, boss: 15 } as const;

type EnemyRank = "normal" | "elite" | "boss";
type PreviewPendingRoom =
  | { kind: "merchant"; offer: MerchantOffer; purchasedOfferIds: readonly string[] }
  | { kind: "treasure"; offer: TreasureOffer }
  | { kind: "event"; offer: EventOffer; result: EventChoiceResult | null }
  | null;

export function CombatStage({ initialMap = previewRunMap }: Readonly<{ initialMap?: RunMapModel }>) {
  const [route, setRoute] = useState(() => ({
    availableRoomIds: initialMap.layers[0]!.nodes.map((node) => node.id),
    visitedRoomIds: [] as string[],
    currentRoomId: null as string | null,
  }));
  const [pendingNextIds, setPendingNextIds] = useState<readonly string[]>([]);
  const [pendingRoom, setPendingRoom] = useState<PreviewPendingRoom>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [combatActive, setCombatActive] = useState(false);
  const [enemyMaxHp, setEnemyMaxHp] = useState(18);
  const [enemyName, setEnemyName] = useState("Aguardando destino");
  const [enemyRank, setEnemyRank] = useState<EnemyRank>("normal");
  const [heroHp, setHeroHp] = useState(24);
  const [gold, setGold] = useState(12);
  const [runEssence, setRunEssence] = useState(2);
  const [inventory, setInventory] = useState<readonly RunItemId[]>([]);
  const [classSides, setClassSides] = useState<4 | 6>(4);
  const [className, setClassName] = useState("Escudeiro");
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [event, setEvent] = useState<BattleAnimationEvent | null>(null);
  const [message, setMessage] = useState("Escolha um Dado de Local alcançável.");
  const isHostingerPreview = process.env.NEXT_PUBLIC_HOSTINGER_PREVIEW === "1";

  const finishCombat = () => {
    setCombatActive(false);
    setEvent({ id: Date.now(), type: "hit" });
    setGold((current) => current + COMBAT_GOLD[enemyRank]);
    setMessage("Vitória! Experiência e ouro da sala recebidos.");
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
    onHeroHpChange: (nextHeroHp) => {
      setHeroHp(nextHeroHp);
      setEvent({ id: Date.now(), type: "enemy-hit" });
    },
    onVictory: finishCombat,
  });

  const completePendingRoom = (nextMessage: string) => {
    setPendingRoom(null);
    setRoomError(null);
    setRoute((current) => ({ ...current, availableRoomIds: [...pendingNextIds] }));
    setMessage(nextMessage);
  };

  const chooseRoom = (roomId: string) => {
    if (pendingRoom || !route.availableRoomIds.includes(roomId)) return;
    const node = initialMap.layers.flatMap((layer) => layer.nodes).find((candidate) => candidate.id === roomId);
    if (!node) return;
    const isCombat = COMBAT_TYPES.has(node.type);
    const isInteractive = node.type === "merchant" || node.type === "treasure" || node.type === "event";
    setPendingNextIds(node.nextNodeIds);
    setRoute((current) => ({
      currentRoomId: roomId,
      visitedRoomIds: [...current.visitedRoomIds, roomId],
      availableRoomIds: isCombat || isInteractive ? [] : [...node.nextNodeIds],
    }));
    setRoomError(null);

    if (isCombat) {
      const rank = node.type as "combat" | "elite" | "boss";
      setEnemyMaxHp(ENEMY_HP[rank]);
      setEnemyName(ENEMY_NAME[rank]);
      setEnemyRank(rank === "combat" ? "normal" : rank);
      setRunEssence(2);
      setCombatActive(true);
      setMessage("Os dados de dano, defesa e ataque inimigo foram invocados.");
      return;
    }

    if (node.type === "merchant") {
      setPendingRoom({
        kind: "merchant",
        offer: createMerchantOffer(roomId, 0, Object.keys(RUN_ITEMS)),
        purchasedOfferIds: [],
      });
      setMessage("O mercador abriu o livro-caixa.");
      return;
    }

    if (node.type === "treasure") {
      setPendingRoom({ kind: "treasure", offer: createTreasureOffer(roomId, 0, Object.keys(RUN_ITEMS)) });
      setMessage("O cofre exige uma única escolha.");
      return;
    }

    if (node.type === "event") {
      const eventContent = seasonOne.events.find((candidate) => candidate.id === "goblin-insurance");
      if (!eventContent) throw new Error("event content is unavailable");
      setPendingRoom({ kind: "event", offer: createEventOffer(eventContent, roomId, 0), result: null });
      setMessage("Um goblin agita uma apólice assustadoramente longa.");
      return;
    }

    setMessage(`Local resolvido: ${node.type}. Experiência de jornada recebida.`);
  };

  const reroll = (kind: "damage" | "defense") => {
    combat.reroll(kind);
    if (combat.phase === "intervention" && combat.essence > 0) {
      setRunEssence((current) => Math.max(0, current - 1));
    }
    setEvent({ id: Date.now(), type: "reroll" });
  };

  const buyMerchantItem = (offerId: string) => {
    if (!pendingRoom || pendingRoom.kind !== "merchant") return;
    try {
      const option = chooseMerchantItem(pendingRoom.offer, offerId);
      const purchased = purchaseLegacyItem({ gold, heroHp, heroMaxHp: 24, inventory }, option.itemId);
      setGold(purchased.gold);
      setHeroHp(purchased.heroHp);
      setInventory(purchased.inventory);
      setPendingRoom({ ...pendingRoom, purchasedOfferIds: [...pendingRoom.purchasedOfferIds, offerId] });
      setRoomError(null);
    } catch (error) {
      setRoomError(error instanceof Error && /gold/i.test(error.message)
        ? "Ouro insuficiente para esta compra."
        : "Esta oferta não está mais disponível.");
    }
  };

  const chooseTreasure = (offerId: string) => {
    if (!pendingRoom || pendingRoom.kind !== "treasure") return;
    const option = chooseTreasureReward(pendingRoom.offer, offerId);
    if (option.payload.kind === "gold") {
      const amount = option.payload.amount;
      setGold((current) => current + amount);
    }
    if (option.payload.kind === "essence") {
      const amount = option.payload.amount;
      setRunEssence((current) => Math.min(2, current + amount));
    }
    if (option.payload.kind === "item") {
      const item = RUN_ITEMS[option.payload.itemId];
      if (item.kind === "consumable") setHeroHp((current) => Math.min(24, current + 6));
      else setInventory((current) => current.includes(item.id) ? current : [...current, item.id]);
    }
    completePendingRoom("Tesouro escolhido. O cofre fechou antes da segunda tentativa.");
  };

  const chooseEventOption = (offerId: string) => {
    if (!pendingRoom || pendingRoom.kind !== "event" || pendingRoom.result) return;
    try {
      const result = resolveEventChoice({
        offer: pendingRoom.offer,
        offerId,
        seed: route.currentRoomId ?? "preview-event",
        rngCursor: pendingRoom.offer.rngCursor,
        gold,
      });
      setGold(result.gold);
      setHeroHp((current) => Math.max(0, Math.min(24, current + result.hpDelta)));
      setPendingRoom({ ...pendingRoom, result });
      setRoomError(null);
    } catch (error) {
      setRoomError(error instanceof Error && /gold/i.test(error.message)
        ? "Você não tem ouro suficiente para comprar o seguro."
        : "Essa escolha não está disponível.");
    }
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
      <main className="game-shell" aria-hidden={pendingRoom ? true : undefined}>
        <HeroSheet />
        <section className="battle-column">
          <header className="combat-header">
            <div><b>{className} D{classSides}</b><span>♥ {combat.heroHp}/24 · ● {gold} · ◆ {runEssence}</span></div>
            <div className="room-progress"><b>Sala {route.visitedRoomIds.length}/10</b><span>XP da run · evolução temporária</span></div>
            <div className="enemy"><b>{enemyName}</b><span>♥ {combat.enemyHp}/{enemyMaxHp}</span></div>
          </header>
          <PhaserBattle event={event} enemyRank={enemyRank} />
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
            {phaseMessage}<EssenceMeter value={runEssence} max={2} />
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
      {pendingRoom?.kind === "merchant" ? (
        <MerchantRoom
          offer={pendingRoom.offer}
          gold={gold}
          heroHp={heroHp}
          heroMaxHp={24}
          essence={runEssence}
          purchasedOfferIds={pendingRoom.purchasedOfferIds}
          error={roomError}
          onBuy={buyMerchantItem}
          onLeave={() => completePendingRoom("Compras encerradas. A taxa de saída foi misteriosamente dispensada.")}
        />
      ) : null}
      {pendingRoom?.kind === "treasure" ? (
        <TreasureRoom
          offer={pendingRoom.offer}
          gold={gold}
          heroHp={heroHp}
          heroMaxHp={24}
          essence={runEssence}
          onChoose={chooseTreasure}
        />
      ) : null}
      {pendingRoom?.kind === "event" ? (
        <EventRoom
          offer={pendingRoom.offer}
          result={pendingRoom.result}
          gold={gold}
          heroHp={heroHp}
          heroMaxHp={24}
          essence={runEssence}
          error={roomError}
          onChoose={chooseEventOption}
          onAcknowledge={() => completePendingRoom("Evento resolvido. O goblin já está vendendo a história para outro invocador.")}
        />
      ) : null}
    </Fragment>
  );
}
