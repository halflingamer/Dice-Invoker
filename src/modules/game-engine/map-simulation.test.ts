import { describe, expect, it } from "vitest";
import { generateMap, type RunMap, type RoomType } from "./map";

const RECOVERY_TYPES = new Set<RoomType>(["rest", "merchant"]);

function fairnessViolations(map: RunMap): string[] {
  const violations: string[] = [];
  const nodes = new Map(map.layers.flatMap((layer) => layer.nodes.map((node) => [node.id, node])));
  const reachableWithoutRecovery = new Set(
    map.layers[0]!.nodes.filter((node) => !RECOVERY_TYPES.has(node.type)).map((node) => node.id),
  );

  for (const layer of map.layers.slice(0, -1)) {
    for (const node of layer.nodes) {
      for (const nextId of node.nextNodeIds) {
        const next = nodes.get(nextId)!;
        if (node.type === "elite" && next.type === "elite") violations.push(`consecutive elites at ${node.id}`);
        for (const afterId of next.nextNodeIds) {
          const after = nodes.get(afterId)!;
          if (node.type === next.type && next.type === after.type) violations.push(`triple ${node.type} at ${node.id}`);
        }
        if (reachableWithoutRecovery.has(node.id) && !RECOVERY_TYPES.has(next.type)) {
          reachableWithoutRecovery.add(next.id);
        }
      }
    }
  }

  if (map.layers.at(-1)!.nodes.some((boss) => reachableWithoutRecovery.has(boss.id))) {
    violations.push("boss reachable without recovery");
  }
  return violations;
}

describe("controlled map simulation", () => {
  it("protects every complete path across five thousand seeds", () => {
    const observed = new Map<RoomType, number>();

    for (let seed = 0; seed < 5_000; seed += 1) {
      const map = generateMap(`simulation-seed-${seed}`);
      expect(fairnessViolations(map), `seed ${seed}`).toEqual([]);
      expect(map.layers).toHaveLength(10);
      expect(map.layers.at(-1)?.nodes).toEqual([
        { id: "room-10-1", type: "boss", nextNodeIds: [] },
      ]);

      for (const node of map.layers.flatMap((layer) => layer.nodes)) {
        observed.set(node.type, (observed.get(node.type) ?? 0) + 1);
      }
    }

    expect(observed.get("combat")).toBeGreaterThan(observed.get("elite") ?? 0);
    expect(observed.get("event")).toBeGreaterThan(observed.get("elite") ?? 0);
    expect(observed.get("boss")).toBe(5_000);
  }, 30_000);
});
