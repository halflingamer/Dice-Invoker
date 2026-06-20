import { describe, expect, it } from "vitest";
import { generateMap, type MapNode, type RunMap, type RoomType } from "./map";

const RECOVERY_TYPES = new Set<RoomType>(["rest", "merchant"]);

function enumeratePaths(map: RunMap): MapNode[][] {
  const nodes = new Map(map.layers.flatMap((layer) => layer.nodes.map((node) => [node.id, node])));
  const paths: MapNode[][] = [];
  const visit = (path: MapNode[]) => {
    const current = path.at(-1)!;
    if (current.nextNodeIds.length === 0) paths.push(path);
    else current.nextNodeIds.forEach((id) => visit([...path, nodes.get(id)!]));
  };
  map.layers[0]!.nodes.forEach((node) => visit([node]));
  return paths;
}

function pathViolations(map: RunMap): string[] {
  const violations: string[] = [];
  for (const path of enumeratePaths(map)) {
    const choices = path.slice(0, -1);
    if (!choices.some((node) => RECOVERY_TYPES.has(node.type))) violations.push("route lacks recovery");
    for (let index = 0; index < choices.length - 1; index += 1) {
      if (choices[index]!.type === "elite" && choices[index + 1]!.type === "elite") violations.push("consecutive elites");
    }
    for (let index = 0; index < choices.length - 2; index += 1) {
      if (choices[index]!.type === choices[index + 1]!.type && choices[index + 1]!.type === choices[index + 2]!.type) {
        violations.push(`triple ${choices[index]!.type}`);
      }
    }
  }
  return violations;
}

describe("controlled map simulation", () => {
  it("protects every complete path across one thousand seeds and all seven phase sizes", () => {
    const observed = new Map<RoomType, number>();

    for (let seed = 0; seed < 1_000; seed += 1) {
      for (let roomCount = 3; roomCount <= 9; roomCount += 1) {
        const phaseIndex = roomCount - 2;
        const map = generateMap({ seed: `simulation-seed-${seed}`, phaseIndex, roomCount });
        expect(pathViolations(map), `seed ${seed}, phase ${phaseIndex}`).toEqual([]);
        expect(map.layers).toHaveLength(roomCount + 1);
        expect(map.layers.at(-1)?.nodes).toEqual([
          { id: `phase-${phaseIndex}-room-${roomCount + 1}-1`, type: "boss", nextNodeIds: [] },
        ]);
        for (const node of map.layers.flatMap((layer) => layer.nodes)) {
          observed.set(node.type, (observed.get(node.type) ?? 0) + 1);
        }
      }
    }

    expect(observed.get("combat")).toBeGreaterThan(observed.get("elite") ?? 0);
    expect(observed.get("event")).toBeGreaterThan(observed.get("elite") ?? 0);
    expect(observed.get("boss")).toBe(7_000);
  }, 30_000);
});
