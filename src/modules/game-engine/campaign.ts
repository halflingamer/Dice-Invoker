import type { DungeonPhase } from "@/modules/content/schema";
import { generateMap, type RunMap } from "./map";

export type CampaignPhaseMap = Readonly<{
  phaseId: string;
  phaseIndex: number;
  difficulty: number;
  bossInvaderId: string;
  map: RunMap;
}>;

export function createCampaignMaps(
  seed: string,
  phases: readonly DungeonPhase[],
): CampaignPhaseMap[] {
  return phases.map((phase) => ({
    phaseId: phase.id,
    phaseIndex: phase.index,
    difficulty: phase.difficulty,
    bossInvaderId: phase.bossInvaderId,
    map: generateMap({ seed, phaseIndex: phase.index, roomCount: phase.roomCount }),
  }));
}
