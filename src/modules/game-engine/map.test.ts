import { describe, expect, it } from "vitest";
import { generateMap, type MapNode, type RunMap } from "./map";

function enumeratePaths(map: RunMap): MapNode[][] {
  const nodes = new Map(map.layers.flatMap((layer) => layer.nodes.map((node) => [node.id, node])));
  const paths: MapNode[][] = [];
  const visit = (path: MapNode[]) => {
    const current = path.at(-1)!;
    if (current.nextNodeIds.length === 0) {
      paths.push(path);
      return;
    }
    current.nextNodeIds.forEach((id) => visit([...path, nodes.get(id)!]));
  };
  map.layers[0]!.nodes.forEach((node) => visit([node]));
  return paths;
}

describe("generateMap", () => {
  it("creates ten sparse connected layers of location dice", () => {
    const map = generateMap("map-seed-1");

    expect(map.layers).toHaveLength(10);
    expect(map.layers.slice(0, -1).every((layer) => [2, 3].includes(layer.nodes.length))).toBe(true);
    expect(map.layers.at(-1)?.nodes).toHaveLength(1);

    const allNodes = map.layers.flatMap((layer) => layer.nodes);
    expect(new Set(allNodes.map((node) => node.id)).size).toBe(allNodes.length);

    for (const [index, layer] of map.layers.entries()) {
      expect(layer.index).toBe(index + 1);
      for (const node of layer.nodes) {
        if (index === map.layers.length - 1) {
          expect(node).toMatchObject({ type: "boss", nextNodeIds: [] });
        } else {
          expect(node.type).not.toBe("boss");
          expect(node.nextNodeIds.length).toBeGreaterThan(0);
          expect(node.nextNodeIds.every((id) => map.layers[index + 1]!.nodes.some((candidate) => candidate.id === id))).toBe(true);
        }
      }
    }

    for (const layer of map.layers.slice(1)) {
      for (const node of layer.nodes) {
        expect(allNodes.some((candidate) => candidate.nextNodeIds.includes(node.id))).toBe(true);
      }
    }

    const hasSparseTransition = map.layers.slice(0, -2).some((layer, index) => {
      const nextWidth = map.layers[index + 1]!.nodes.length;
      const edgeCount = layer.nodes.reduce((total, node) => total + node.nextNodeIds.length, 0);
      return edgeCount < layer.nodes.length * nextWidth;
    });
    expect(hasSparseTransition).toBe(true);
    expect(enumeratePaths(map).length).toBeGreaterThan(1);
  });

  it("is deterministic while keeping every non-boss layer unfixed across runs", () => {
    expect(generateMap("map-seed-2")).toEqual(generateMap("map-seed-2"));

    const observedByLayer = Array.from({ length: 9 }, () => new Set<string>());
    for (let seed = 0; seed < 80; seed += 1) {
      generateMap(`variable-seed-${seed}`).layers.slice(0, -1).forEach((layer, index) => {
        layer.nodes.forEach((node) => observedByLayer[index]!.add(node.type));
      });
    }

    expect(observedByLayer.every((types) => types.size > 1)).toBe(true);
  });

  it("shows different rolled faces at each choice whenever there is a fork", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const map = generateMap(`choice-seed-${seed}`);
      for (const layer of map.layers.slice(0, -1)) {
        expect(new Set(layer.nodes.map((node) => node.type)).size).toBeGreaterThan(1);
      }
    }
  });
});
