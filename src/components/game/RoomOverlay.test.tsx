import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EventRoom } from "./EventRoom";
import { MerchantRoom } from "./MerchantRoom";
import { TreasureRoom } from "./TreasureRoom";

afterEach(cleanup);

it("sends only the selected supplier offer id", () => {
  const onBuy = vi.fn();

  render(
    <MerchantRoom
      gold={12}
      heroHp={18}
      heroMaxHp={24}
      essence={2}
      purchasedOfferIds={[]}
      offer={{
        options: [
          { offerId: "merchant-1", itemId: "sharp-sword" },
          { offerId: "merchant-2", itemId: "reinforced-shield" },
          { offerId: "merchant-3", itemId: "healing-potion" },
        ],
        rngCursor: 4,
      }}
      onBuy={onBuy}
      onLeave={vi.fn()}
    />,
  );

  expect(screen.getByRole("dialog", { name: "Fornecedor da Dungeon" })).toBeInTheDocument();
  expect(screen.getByLabelText("Recursos da dungeon")).toHaveTextContent(/Núcleo/);
  fireEvent.click(screen.getByRole("button", { name: /Comprar Espada Afiada/i }));
  expect(onBuy).toHaveBeenCalledWith("merchant-1");
});

it("shows one dungeon stock choice for each reward kind", () => {
  render(
    <TreasureRoom
      gold={12}
      heroHp={24}
      heroMaxHp={24}
      essence={1}
      offer={{
        options: [
          { offerId: "gold", payload: { kind: "gold", amount: 9 } },
          { offerId: "item", payload: { kind: "item", itemId: "tax-amulet" } },
          { offerId: "essence", payload: { kind: "essence", amount: 1 } },
        ],
        rngCursor: 3,
      }}
      onChoose={vi.fn()}
    />,
  );

  expect(screen.getByRole("dialog", { name: "Estoque da Dungeon" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Estoque.*9 ouro/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /Estoque.*Amuleto Fiscal/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /Estoque.*1 essência/i })).toBeEnabled();
});

it("shows anti-adventurer event choices and then requires acknowledgement of the consequence", () => {
  const onChoose = vi.fn();
  const onAcknowledge = vi.fn();
  const { rerender } = render(
    <EventRoom
      gold={12}
      heroHp={24}
      heroMaxHp={24}
      essence={2}
      offer={{
        eventId: "goblin-insurance",
        options: [
          { offerId: "buy", optionId: "buy", label: "Comprar seguro" },
          { offerId: "ignore", optionId: "ignore", label: "Ignorar" },
          { offerId: "steal", optionId: "steal", label: "Roubar" },
        ],
        rngCursor: 3,
      }}
      result={null}
      onChoose={onChoose}
      onAcknowledge={onAcknowledge}
    />,
  );

  expect(screen.getByRole("dialog", { name: "Seguro Anti-Aventureiro" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Roubar/i }));
  expect(onChoose).toHaveBeenCalledWith("steal");

  rerender(
    <EventRoom
      gold={12}
      heroHp={21}
      heroMaxHp={24}
      essence={2}
      offer={{
        eventId: "goblin-insurance",
        options: [
          { offerId: "buy", optionId: "buy", label: "Comprar seguro" },
          { offerId: "ignore", optionId: "ignore", label: "Ignorar" },
          { offerId: "steal", optionId: "steal", label: "Roubar" },
        ],
        rngCursor: 3,
      }}
      result={{
        gold: 12,
        hasInsurance: false,
        hpDelta: -3,
        rngCursor: 4,
        audit: { eventId: "goblin-insurance", optionId: "steal", outcome: "failure" },
      }}
      onChoose={onChoose}
      onAcknowledge={onAcknowledge}
    />,
  );

  expect(screen.getByText(/guardião perdeu 3 de núcleo/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Voltar à defesa/i }));
  expect(onAcknowledge).toHaveBeenCalledOnce();
});
