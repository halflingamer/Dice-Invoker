import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EventRoom } from "./EventRoom";
import { MerchantRoom } from "./MerchantRoom";
import { TreasureRoom } from "./TreasureRoom";

afterEach(cleanup);

it("sends only the selected merchant offer id", () => {
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

  expect(screen.getByRole("dialog", { name: "Mercador Tributário" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Comprar Espada Afiada/i }));
  expect(onBuy).toHaveBeenCalledWith("merchant-1");
});

it("shows one treasure choice for each reward kind", () => {
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

  expect(screen.getByRole("button", { name: /Tesouro.*9 ouro/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /Tesouro.*Amuleto Fiscal/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /Tesouro.*1 essência/i })).toBeEnabled();
});

it("shows event choices and then requires acknowledgement of the consequence", () => {
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

  expect(screen.getByText(/pegou você com a mão no cofre/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Continuar jornada/i }));
  expect(onAcknowledge).toHaveBeenCalledOnce();
});
