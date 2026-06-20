"use client";

import { RUN_ITEMS } from "@/modules/game-engine/economy";
import type { MerchantOffer } from "@/modules/game-engine/rewards";
import { RoomOverlay } from "./RoomOverlay";

export function MerchantRoom({
  offer,
  gold,
  heroHp,
  heroMaxHp,
  essence,
  purchasedOfferIds,
  error,
  onBuy,
  onLeave,
}: Readonly<{
  offer: MerchantOffer;
  gold: number;
  heroHp: number;
  heroMaxHp: number;
  essence: number;
  purchasedOfferIds: readonly string[];
  error?: string | null;
  onBuy(offerId: string): void;
  onLeave(): void;
}>) {
  return (
    <RoomOverlay
      title="Mercador Tributário"
      eyebrow="Licença comercial suspeitamente válida"
      gold={gold}
      heroHp={heroHp}
      heroMaxHp={heroMaxHp}
      essence={essence}
    >
      <p className="room-flavor">“Preços honestos, taxas criativas e nenhuma devolução após o apocalipse.”</p>
      {error ? <p className="room-error" role="alert">{error}</p> : null}
      <div className="room-card-grid">
        {offer.options.map((option) => {
          const item = RUN_ITEMS[option.itemId];
          const purchased = purchasedOfferIds.includes(option.offerId);
          const cannotAfford = gold < item.price;
          return (
            <article className="room-card merchant-card" key={option.offerId}>
              <span className="room-card-icon" aria-hidden="true">
                {item.id === "sharp-sword" ? "⚔" : item.id === "reinforced-shield" ? "⬟" : item.id === "healing-potion" ? "✚" : "✦"}
              </span>
              <h3>{item.name}</h3>
              <p>{item.kind === "consumable" ? "Recupera 6 de vida." : "Efeito passivo durante esta run."}</p>
              <button
                type="button"
                disabled={purchased || cannotAfford}
                onClick={() => onBuy(option.offerId)}
                aria-label={`Comprar ${item.name} por ${item.price} ouro`}
              >
                {purchased ? "Comprado" : `Comprar · ${item.price} ouro`}
              </button>
            </article>
          );
        })}
      </div>
      <button className="room-leave-button" type="button" onClick={onLeave}>Sair do mercador</button>
    </RoomOverlay>
  );
}
