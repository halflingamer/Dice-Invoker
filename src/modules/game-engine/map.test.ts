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
  it("preserves the legacy string-seed map contract", () => {
    const map = generateMap("legacy-contract-seed");
    expect(map.layers.map((layer) => layer.nodes.map((node) => node.type))).toEqual([
      ["event", "rest"],
      ["event", "combat", "rest"],
      ["combat", "event", "merchant"],
      ["combat", "elite"],
      ["merchant", "combat"],
      ["combat", "treasure", "event"],
      ["rest", "merchant"],
      ["combat", "treasure"],
      ["combat", "merchant", "event"],
      ["boss"],
    ]);
    expect(map.layers.flatMap((layer) => layer.nodes).map((node) => node.id)).toEqual([
      "room-1-1", "room-1-2", "room-2-1", "room-2-2", "room-2-3", "room-3-1", "room-3-2", "room-3-3",
      "room-4-1", "room-4-2", "room-5-1", "room-5-2", "room-6-1", "room-6-2", "room-6-3", "room-7-1",
      "room-7-2", "room-8-1", "room-8-2", "room-9-1", "room-9-2", "room-9-3", "room-10-1",
    ]);
    expect(map.rngCursor).toBe(95);
  });

  it.each([3, 4, 5, 6, 7, 8, 9])("creates %i choice layers and one boss layer", (roomCount) => {
    const phaseIndex = roomCount - 2;
    const map = generateMap({ seed: "map-seed-1", phaseIndex, roomCount });

    expect(map.layers).toHaveLength(roomCount + 1);
    expect(map.layers.slice(0, -1).every((layer) => [2, 3].includes(layer.nodes.length))).toBe(true);
    expect(map.layers.at(-1)?.nodes).toEqual([
      { id: `phase-${phaseIndex}-room-${roomCount + 1}-1`, type: "boss", nextNodeIds: [] },
    ]);

    const allNodes = map.layers.flatMap((layer) => layer.nodes);
    expect(new Set(allNodes.map((node) => node.id)).size).toBe(allNodes.length);
    expect(allNodes.every((node) => node.id.startsWith(`phase-${phaseIndex}-room-`))).toBe(true);

    for (const [index, layer] of map.layers.entries()) {
      expect(layer.index).toBe(index + 1);
      for (const node of layer.nodes) {
        if (index < roomCount) {
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
    expect(enumeratePaths(map).length).toBeGreaterThan(1);
  });

  it("is deterministic and isolates each phase random stream", () => {
    const input = { seed: "map-seed-2", phaseIndex: 3, roomCount: 5 };
    expect(generateMap(input)).toEqual(generateMap(input));

    const first = generateMap({ ...input, phaseIndex: 1 });
    const second = generateMap({ ...input, phaseIndex: 2 });
    const randomSignature = (map: RunMap) => map.layers.slice(0, -1).map((layer) => ({
      width: layer.nodes.length,
      types: layer.nodes.map((node) => node.type),
      branches: layer.nodes.map((node) => node.nextNodeIds.length),
    }));
    expect(randomSignature(first)).not.toEqual(randomSignature(second));
    expect(first.layers.flatMap((layer) => layer.nodes).every((node) => node.id.startsWith("phase-1-"))).toBe(true);
    expect(second.layers.flatMap((layer) => layer.nodes).every((node) => node.id.startsWith("phase-2-"))).toBe(true);
  });

  it("keeps every choice varied and non-boss layers random across runs", () => {
    const observedByLayer = Array.from({ length: 9 }, () => new Set<string>());
    for (let seed = 0; seed < 100; seed += 1) {
      const map = generateMap({ seed: `variable-seed-${seed}`, phaseIndex: 7, roomCount: 9 });
      map.layers.slice(0, -1).forEach((layer, index) => {
        expect(new Set(layer.nodes.map((node) => node.type)).size).toBeGreaterThan(1);
        layer.nodes.forEach((node) => observedByLayer[index]!.add(node.type));
      });
    }
    expect(observedByLayer.every((types) => types.size > 1)).toBe(true);
  });
});
