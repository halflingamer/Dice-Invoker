"use client";

import type { RunMap as RunMapModel } from "@/modules/game-engine/map";
import type { CampaignSurface } from "./use-preview-campaign";
import { RunMap } from "./RunMap";

export function CampaignMap({
  surface,
  phaseName,
  phaseIndex,
  map,
  availableRoomIds,
  visitedRoomIds,
  currentRoomId,
  onChoose,
}: Readonly<{
  surface: CampaignSurface;
  phaseName: string;
  phaseIndex: number;
  map: RunMapModel;
  availableRoomIds: readonly string[];
  visitedRoomIds: readonly string[];
  currentRoomId: string | null;
  onChoose(id: string): void;
}>) {
  if (surface !== "map") return null;

  return (
    <section className="campaign-map-surface" aria-label="Escolha o próximo local">
      <header className="campaign-map-header">
        <div>
          <span>Fase {phaseIndex}/7</span>
          <h2>{phaseName}</h2>
        </div>
        <p>Defenda a dungeon escolhendo qual sala proteger primeiro contra os aventureiros invasores.</p>
      </header>
      <RunMap
        map={map}
        availableRoomIds={availableRoomIds}
        visitedRoomIds={visitedRoomIds}
        currentRoomId={currentRoomId}
        onChoose={onChoose}
      />
    </section>
  );
}
