"use client";

import { RUN_ITEMS } from "@/modules/game-engine/economy";
import type { TreasureOffer, TreasureOption } from "@/modules/game-engine/rewards";
import { RoomOverlay } from "./RoomOverlay";

function treasureDescription(option: TreasureOption): { icon: string; title: string; detail: string } {
  if (option.payload.kind === "gold") {
    return { icon: "●", title: `${option.payload.amount} ouro`, detail: "Tesouro confiscado de aventureiros invasores." };
  }
  if (option.payload.kind === "essence") {
    return { icon: "◆", title: `${option.payload.amount} essência`, detail: "Energia para alterar o destino da defesa." };
  }
  const item = RUN_ITEMS[option.payload.itemId];
  return { icon: "✦", title: item.name, detail: "Um reforço para o guardião desta run." };
}

export function TreasureRoom({
  offer,
  gold,
  heroHp,
  heroMaxHp,
  essence,
  onChoose,
}: Readonly<{
  offer: TreasureOffer;
  gold: number;
  heroHp: number;
  heroMaxHp: number;
  essence: number;
  onChoose(offerId: string): void;
}>) {
  return (
    <RoomOverlay
      title="Estoque da Dungeon"
      eyebrow="Escolha um reforço para proteger o lar"
      gold={gold}
      heroHp={heroHp}
      heroMaxHp={heroMaxHp}
      essence={essence}
    >
      <p className="room-flavor">O baú range: “uma retirada por guardião; mãos de herói serão mordidas”.</p>
      <div className="room-card-grid">
        {offer.options.map((option) => {
          const description = treasureDescription(option);
          return (
            <button
              className="room-card treasure-card"
              type="button"
              key={option.offerId}
              onClick={() => onChoose(option.offerId)}
              aria-label={`Estoque: escolher ${description.title}`}
            >
              <span className="room-card-icon" aria-hidden="true">{description.icon}</span>
              <strong>{description.title}</strong>
              <small>{description.detail}</small>
            </button>
          );
        })}
      </div>
    </RoomOverlay>
  );
}
