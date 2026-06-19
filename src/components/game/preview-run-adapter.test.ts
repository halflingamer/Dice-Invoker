import { describe, expect, it } from "vitest";
import { previewCapabilities, previewRunMap } from "./preview-run-adapter";

describe("Hostinger preview adapter", () => {
  it("is explicitly isolated from competitive capabilities", () => {
    expect(previewCapabilities).toEqual({
      authentication: false,
      persistence: false,
      ranking: false,
      scoreSubmission: false,
    });
  });

  it("contains only a fixed public demonstration map", () => {
    const serialized = JSON.stringify(previewRunMap);
    expect(previewRunMap.layers).toHaveLength(10);
    expect(previewRunMap.layers.at(-1)?.nodes[0]?.type).toBe("boss");
    expect(serialized).not.toMatch(/seed|secret|database|score/i);
  });
});
