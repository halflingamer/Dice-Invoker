import { seasonOne } from "@/modules/content/season-1";
import { describe, expect, it } from "vitest";
import { createCampaignMaps } from "./campaign";

describe("createCampaignMaps", () => {
  it("generates all seven canonical phase maps with metadata", () => {
    const maps = createCampaignMaps("campaign-seed", seasonOne.phases);

    expect(maps).toHaveLength(7);
    expect(maps.map(({ map }) => map.layers.length)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(maps.map(({ phaseId, phaseIndex, difficulty, bossInvaderId }) => ({
      phaseId, phaseIndex, difficulty, bossInvaderId,
    }))).toEqual(seasonOne.phases.map((phase) => ({
      phaseId: phase.id,
      phaseIndex: phase.index,
      difficulty: phase.difficulty,
      bossInvaderId: phase.bossInvaderId,
    })));
  });

  it("is deterministic while isolating topology and ids by phase", () => {
    const maps = createCampaignMaps("campaign-seed", seasonOne.phases);
    expect(maps).toEqual(createCampaignMaps("campaign-seed", seasonOne.phases));

    const signatures = maps.map(({ map }) => JSON.stringify(map));
    expect(new Set(signatures).size).toBe(7);
    maps.forEach(({ phaseIndex, map }) => {
      expect(map.layers.flatMap((layer) => layer.nodes).every((node) => node.id.startsWith(`phase-${phaseIndex}-`))).toBe(true);
    });
  });
});
