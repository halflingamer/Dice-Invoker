import { describe, expect, it } from "vitest";
import { previewCampaignMaps, previewCapabilities, previewRunMap } from "./preview-run-adapter";

describe("Hostinger preview adapter", () => {
  it("is explicitly isolated from competitive capabilities", () => {
    expect(previewCapabilities).toEqual({
      authentication: false,
      persistence: false,
      ranking: false,
      scoreSubmission: false,
    });
  });

  it("contains seven deterministic public demonstration maps", () => {
    const serialized = JSON.stringify(previewRunMap);
    expect(previewCampaignMaps).toHaveLength(7);
    expect(previewCampaignMaps.map((entry) => entry.map.layers.length)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(previewRunMap).toBe(previewCampaignMaps[0]?.map);
    expect(previewRunMap.layers.at(-1)?.nodes[0]?.type).toBe("boss");
    expect(serialized).not.toMatch(/seed|secret|database|score/i);
  });
});
