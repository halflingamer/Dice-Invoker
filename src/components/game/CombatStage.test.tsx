import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CombatStage } from "./CombatStage";
import type { RunMap } from "@/modules/game-engine/map";

vi.mock("./PhaserBattle", () => ({
  PhaserBattle: () => <div aria-label="Campo de batalha" />,
}));

afterEach(() => {
  cleanup();
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

it("shows the central route and inventory action between rooms", () => {
  render(<CombatStage />);

  expect(screen.getByRole("region", { name: /Escolha.*local/i })).toBeVisible();
  expect(screen.getByRole("button", { name: /Abrir invent/i })).toBeEnabled();
});

it("starts automatic damage and defense rolls after choosing combat", () => {
  vi.useFakeTimers();
  const combatMap: RunMap = {
    rngCursor: 0,
    layers: [{ index: 1, nodes: [{ id: "room-combat", type: "combat", nextNodeIds: [] }] }],
  };
  const { container } = render(<CombatStage initialMap={combatMap} />);

  fireEvent.click(within(container).getByRole("button", { name: /Combate.*alcançável/i }));
  expect(within(container).getByLabelText("Dados de combate")).toHaveClass("is-rolling");

  act(() => vi.advanceTimersByTime(650));
  expect(within(container).getByRole("button", { name: /Rerrolar dano/i })).toBeEnabled();
  expect(within(container).getByRole("button", { name: /Rerrolar defesa/i })).toBeEnabled();
});

const singleRoomMap = (type: "elite" | "boss"): RunMap => ({
  rngCursor: 0,
  layers: [{ index: 1, nodes: [{ id: `room-${type}`, type, nextNodeIds: [] }] }],
});

const interactiveRoomMap = (type: "merchant" | "treasure" | "event"): RunMap => ({
  rngCursor: 0,
  layers: [
    {
      index: 1,
      nodes: [{ id: `room-${type}`, type, nextNodeIds: ["room-next"] }],
    },
    {
      index: 2,
      nodes: [{ id: "room-next", type: "combat", nextNodeIds: [] }],
    },
  ],
});

it.each([
  ["merchant", "Mercador Tributário"],
  ["treasure", "Cofre dos Dados"],
  ["event", "Goblin Vendedor de Seguro"],
] as const)("opens the %s room and keeps the next map choice blocked", (type, dialogName) => {
  const { container } = render(<CombatStage initialMap={interactiveRoomMap(type)} />);

  fireEvent.click(within(container).getByRole("button", { name: new RegExp(type === "merchant" ? "Mercador" : type === "treasure" ? "Tesouro" : "Evento", "i") }));

  expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: /Escolha.*local/i })).toBeNull();
});

it.each([
  ["elite", 6],
  ["boss", 8],
] as const)("uses the %s room rank for the enemy die and presents resolved damage", (rank, sides) => {
  vi.useFakeTimers();
  const { container } = render(<CombatStage initialMap={singleRoomMap(rank)} />);

  const roomName = rank === "boss" ? "Chefão" : "Elite";
  fireEvent.click(within(container).getByRole("button", { name: new RegExp(`${roomName}.*alcan`, "i") }));
  expect(within(container).getByLabelText(new RegExp(`Dado de ataque inimigo D${sides}`))).toBeInTheDocument();

  act(() => vi.advanceTimersByTime(650));
  act(() => vi.advanceTimersByTime(2_500));
  act(() => vi.advanceTimersByTime(250));
  expect(within(container).getByText(/Ataque causou \d+; defesa bloqueou \d+; recebeu \d+/i)).toBeInTheDocument();
});
