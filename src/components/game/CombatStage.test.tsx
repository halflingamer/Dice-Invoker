import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RunMap } from "@/modules/game-engine/map";
import { CombatStage } from "./CombatStage";

vi.mock("./PhaserBattle", () => ({
  PhaserBattle: ({ guardianName, invaderName }: { guardianName: string; invaderName: string }) => (
    <div aria-label={`Campo de batalha: ${guardianName} contra ${invaderName}`} />
  ),
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

it("shows the dungeon guardian fantasy and central route between rooms", () => {
  render(<CombatStage />);

  expect(screen.getByRole("heading", { name: /Guardião da Dungeon/i })).toBeVisible();
  expect(screen.getByRole("heading", { name: /Slime Zelador/i })).toBeVisible();
  expect(screen.getByText(/Defenda seu lar dos aventureiros/i)).toBeVisible();
  expect(screen.getByText(/Defenda a dungeon escolhendo qual sala proteger primeiro/i)).toBeVisible();
  expect(screen.getByRole("region", { name: /Escolha.*local/i })).toBeVisible();
  expect(screen.getByRole("button", { name: /Abrir invent/i })).toBeEnabled();
});

it("starts automatic rolls with the slime defending against an invading squire", () => {
  vi.useFakeTimers();
  const combatMap: RunMap = {
    rngCursor: 0,
    layers: [{ index: 1, nodes: [{ id: "room-combat", type: "combat", nextNodeIds: [] }] }],
  };
  const { container } = render(<CombatStage initialMap={combatMap} />);

  fireEvent.click(within(container).getByRole("button", { name: /Combate.*alcan/i }));
  expect(within(container).getByRole("banner")).toHaveTextContent(/Slime Zelador D4/i);
  expect(within(container).getByRole("banner")).toHaveTextContent(/Escudeiro Invasor/i);
  expect(within(container).getByLabelText(/Slime Zelador contra Escudeiro Invasor/i)).toBeInTheDocument();
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
  ["merchant", "Fornecedor da Dungeon"],
  ["treasure", "Estoque da Dungeon"],
  ["event", "Seguro Anti-Aventureiro"],
] as const)("opens the %s room as a dungeon-defense room and blocks the next map choice", (type, dialogName) => {
  const { container } = render(<CombatStage initialMap={interactiveRoomMap(type)} />);

  fireEvent.click(within(container).getByRole("button", { name: new RegExp(type === "merchant" ? "Mercador" : type === "treasure" ? "Tesouro" : "Evento", "i") }));

  expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: /Escolha.*local/i })).toBeNull();
});

it.each([
  ["elite", 6, /Capitã Aventureira/i],
  ["boss", 8, /Fiscal Real da Privatização/i],
] as const)("uses the %s invader rank for the attack die and presents resolved damage", (rank, sides, invaderName) => {
  vi.useFakeTimers();
  const { container } = render(<CombatStage initialMap={singleRoomMap(rank)} />);

  const roomName = rank === "boss" ? "Chefão" : "Elite";
  fireEvent.click(within(container).getByRole("button", { name: new RegExp(`${roomName}.*alcan`, "i") }));
  expect(within(container).getByRole("banner")).toHaveTextContent(invaderName);
  expect(within(container).getByLabelText(new RegExp(`Dado de ataque invasor D${sides}`))).toBeInTheDocument();

  act(() => vi.advanceTimersByTime(650));
  act(() => vi.advanceTimersByTime(2_500));
  act(() => vi.advanceTimersByTime(250));
  expect(within(container).getByText(/Ataque causou \d+; defesa bloqueou \d+; recebeu \d+/i)).toBeInTheDocument();
});
