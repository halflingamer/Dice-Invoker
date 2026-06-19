import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RunMap as RunMapModel } from "@/modules/game-engine/map";
import { RunMap } from "./RunMap";

const map: RunMapModel = {
  rngCursor: 12,
  layers: [
    {
      index: 1,
      nodes: [
        { id: "room-1-1", type: "combat", nextNodeIds: ["room-2-1"] },
        { id: "room-1-2", type: "event", nextNodeIds: ["room-2-2"] },
      ],
    },
    {
      index: 2,
      nodes: [
        { id: "room-2-1", type: "rest", nextNodeIds: ["room-3-1"] },
        { id: "room-2-2", type: "elite", nextNodeIds: ["room-3-1"] },
      ],
    },
    { index: 3, nodes: [{ id: "room-3-1", type: "boss", nextNodeIds: [] }] },
  ],
};

describe("RunMap", () => {
  it("renders symbols, connections, and accessible route states", () => {
    const { container } = render(
      <RunMap
        map={map}
        availableRoomIds={["room-2-1"]}
        visitedRoomIds={["room-1-1"]}
        currentRoomId="room-1-1"
        onChoose={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /Descanso.*alcançável/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Elite.*bloqueado/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Combate.*selecionado/i })).toBeDisabled();
    expect(screen.getByText("⚔")).toBeInTheDocument();
    expect(container.querySelectorAll(".route-line")).toHaveLength(4);
  });

  it("chooses only an available location die", () => {
    const onChoose = vi.fn();
    render(
      <RunMap
        map={map}
        availableRoomIds={["room-1-1", "room-1-2"]}
        visitedRoomIds={[]}
        currentRoomId={null}
        onChoose={onChoose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Evento.*alcançável/i }));
    expect(onChoose).toHaveBeenCalledWith("room-1-2");
  });
});
