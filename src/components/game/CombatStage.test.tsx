import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CombatStage } from "./CombatStage";

vi.mock("./PhaserBattle", () => ({
  PhaserBattle: () => <div aria-label="Campo de batalha" />,
}));

afterEach(() => vi.unstubAllEnvs());

it("identifies the Hostinger static build as a non-ranked demonstration", () => {
  vi.stubEnv("NEXT_PUBLIC_HOSTINGER_PREVIEW", "1");

  render(<CombatStage />);

  expect(screen.getByRole("status", { name: /prévia hostinger/i })).toHaveTextContent(
    /demonstração.*não envia pontuação/i,
  );
});
