"use client";

import type { EventChoiceResult, EventOffer } from "@/modules/game-engine/events";
import { RoomOverlay } from "./RoomOverlay";

function resultCopy(result: EventChoiceResult): string {
  if (result.audit.outcome === "purchased") return "Seguro adquirido. O goblin carimbou sete vias e prometeu não vender seu mapa aos heróis.";
  if (result.audit.outcome === "ignored") return "Você ignorou a proposta. O goblin anotou uma taxa de indiferença no livro da dungeon.";
  if (result.audit.outcome === "success") return "Roubo perfeito! Você encontrou uma apólice em branco e registrou a dungeon como beneficiária.";
  if (result.audit.outcome === "failure") return "O goblin pegou você com a mão no cofre. O guardião perdeu 3 de núcleo.";
  return "O destino registrou sua escolha e cobrou uma pequena taxa narrativa.";
}

export function EventRoom({
  offer,
  result,
  gold,
  heroHp,
  heroMaxHp,
  essence,
  error,
  onChoose,
  onAcknowledge,
}: Readonly<{
  offer: EventOffer;
  result: EventChoiceResult | null;
  gold: number;
  heroHp: number;
  heroMaxHp: number;
  essence: number;
  error?: string | null;
  onChoose(offerId: string): void;
  onAcknowledge(): void;
}>) {
  return (
    <RoomOverlay
      title="Seguro Anti-Aventureiro"
      eyebrow="Evento de consequências perfeitamente legais"
      gold={gold}
      heroHp={heroHp}
      heroMaxHp={heroMaxHp}
      essence={essence}
    >
      {result ? (
        <div className="event-result" aria-live="polite">
          <span className="room-card-icon" aria-hidden="true">{result.audit.outcome === "failure" ? "!" : "✓"}</span>
          <p>{resultCopy(result)}</p>
          <button type="button" onClick={onAcknowledge}>Voltar à defesa</button>
        </div>
      ) : (
        <>
          <p className="room-flavor">“Por cinco moedas, garanto proteção contra paladinos, bardos e cláusulas legíveis.”</p>
          {error ? <p className="room-error" role="alert">{error}</p> : null}
          <div className="room-card-grid event-options">
            {offer.options.map((option) => (
              <button className="room-card event-card" type="button" key={option.offerId} onClick={() => onChoose(option.offerId)}>
                <strong>{option.label}</strong>
                <small>
                  {option.optionId === "buy" ? "Custa 5 ouro e protege a dungeon." : option.optionId === "steal" ? "40% de sucesso; falhar machuca o guardião." : "Sem custo. Sem garantia contra heróis."}
                </small>
              </button>
            ))}
          </div>
        </>
      )}
    </RoomOverlay>
  );
}
