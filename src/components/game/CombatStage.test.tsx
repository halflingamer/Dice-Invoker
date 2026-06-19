import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CombatStage } from "./CombatStage";

vi.mock("./PhaserBattle", () => ({
  PhaserBattle: () => <div aria-label="Campo de batalha" />,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it("identifies the Hostinger static build as a non-ranked demonstration", () => {
  vi.stubEnv("NEXT_PUBLIC_HOSTINGER_PREVIEW", "1");

  render(<CombatStage />);

  expect(screen.getByRole("status", { name: /prévia hostinger/i })).toHaveTextContent(
    /demonstração.*não envia pontuação/i,
  );
});

it("starts automatic damage and defense rolls after choosing combat", () => {
  vi.useFakeTimers();
  const { container } = render(<CombatStage />);

  fireEvent.click(within(container).getByRole("button", { name: /Combate.*alcançável/i }));
  expect(within(container).getByLabelText("Dados de combate")).toHaveClass("is-rolling");

  act(() => vi.advanceTimersByTime(650));
  expect(within(container).getByRole("button", { name: /Rerrolar dano/i })).toBeEnabled();
  expect(within(container).getByRole("button", { name: /Rerrolar defesa/i })).toBeEnabled();
});
