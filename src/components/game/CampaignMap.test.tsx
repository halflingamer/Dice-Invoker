import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RunMap as RunMapModel } from "@/modules/game-engine/map";
import { CampaignMap } from "./CampaignMap";

const map: RunMapModel = {
  rngCursor: 1,
  layers: [
    {
      index: 1,
      nodes: [
        { id: "phase-1-room-1-1", type: "combat", nextNodeIds: ["phase-1-room-2-1"] },
        { id: "phase-1-room-1-2", type: "treasure", nextNodeIds: ["phase-1-room-2-1"] },
      ],
    },
    { index: 2, nodes: [{ id: "phase-1-room-2-1", type: "boss", nextNodeIds: [] }] },
  ],
};

describe("CampaignMap", () => {
  it("shows the route as the main surface only between rooms", () => {
    const { rerender } = render(
      <CampaignMap
        surface="map"
        phaseName="Entrada Saqueada"
        phaseIndex={1}
        map={map}
        availableRoomIds={["phase-1-room-1-1", "phase-1-room-1-2"]}
        visitedRoomIds={[]}
        currentRoomId={null}
        onChoose={() => undefined}
      />,
    );

    expect(screen.getByRole("region", { name: "Escolha o prÃ³ximo local" })).toBeVisible();
    expect(screen.getByText("Fase 1/7")).toBeVisible();

    rerender(
      <CampaignMap
        surface="combat"
        phaseName="Entrada Saqueada"
        phaseIndex={1}
        map={map}
        availableRoomIds={["phase-1-room-1-1"]}
        visitedRoomIds={[]}
        currentRoomId={null}
        onChoose={() => undefined}
      />,
    );

    expect(screen.queryByRole("region", { name: "Escolha o prÃ³ximo local" })).toBeNull();
  });

  it("forwards reachable location choices", () => {
    const onChoose = vi.fn();
    render(
      <CampaignMap
        surface="map"
        phaseName="Entrada Saqueada"
        phaseIndex={1}
        map={map}
        availableRoomIds={["phase-1-room-1-2"]}
        visitedRoomIds={[]}
        currentRoomId={null}
        onChoose={onChoose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Tesouro.*alcan/i }));

    expect(onChoose).toHaveBeenCalledWith("phase-1-room-1-2");
  });
});
