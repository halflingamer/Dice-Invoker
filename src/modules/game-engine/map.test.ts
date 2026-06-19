import { describe, expect, it } from "vitest";
import { generateMap } from "./map";

describe("generateMap", () => {
  it("creates ten connected layers with a reachable branch and a final boss", () => {
    const map = generateMap("map-seed-1");

    expect(map.layers).toHaveLength(10);
    expect(map.layers.some((layer) => layer.nodes.length > 1)).toBe(true);

    const allNodes = map.layers.flatMap((layer) => layer.nodes);
    const nodeIds = new Set(allNodes.map((node) => node.id));
    expect(nodeIds.size).toBe(allNodes.length);

    for (const [index, layer] of map.layers.entries()) {
      expect(layer.index).toBe(index + 1);
      for (const node of layer.nodes) {
        if (index === map.layers.length - 1) {
          expect(node.type).toBe("boss");
          expect(node.nextNodeIds).toEqual([]);
        } else {
          expect(node.type).not.toBe("boss");
          expect(node.nextNodeIds.length).toBeGreaterThan(0);
          expect(node.nextNodeIds.every((id) => map.layers[index + 1]?.nodes.some((node) => node.id === id))).toBe(true);
        }
      }
    }

    const reachable = new Set(map.layers[0]?.nodes.map((node) => node.id));
    for (const layer of map.layers.slice(0, -1)) {
      for (const node of layer.nodes) {
        if (reachable.has(node.id)) node.nextNodeIds.forEach((id) => reachable.add(id));
      }
    }
    expect(allNodes.every((node) => reachable.has(node.id))).toBe(true);
  });

  it("is deterministic and enforces elite and boss layer rules", () => {
    const first = generateMap("map-seed-2");
    const second = generateMap("map-seed-2");

    expect(first).toEqual(second);
    expect(first.layers[4]?.nodes.every((node) => node.type === "elite")).toBe(true);
    expect(first.layers[8]?.nodes.every((node) => node.type !== "elite")).toBe(true);
    expect(first.layers[9]?.nodes.every((node) => node.type === "boss")).toBe(true);
  });
});
