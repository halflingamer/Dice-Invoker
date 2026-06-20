import { createNamedRollStream, type RollStream } from "./rng";

export type RoomType = "combat" | "elite" | "treasure" | "merchant" | "event" | "rest" | "boss";

export type MapNode = Readonly<{
  id: string;
  type: RoomType;
  nextNodeIds: readonly string[];
}>;

export type MapLayer = Readonly<{
  index: number;
  nodes: readonly MapNode[];
}>;

export type RunMap = Readonly<{
  layers: readonly MapLayer[];
  rngCursor: number;
}>;

type NodeDraft = { id: string; type: RoomType; nextNodeIds: string[] };
type LayerDraft = { index: number; nodes: NodeDraft[] };

export type GenerateMapInput = Readonly<{
  seed: string;
  phaseIndex: number;
  roomCount: number;
}>;

const ROOM_BAG: readonly RoomType[] = [
  "combat", "combat", "combat", "combat", "combat", "combat", "combat", "combat",
  "event", "event", "event", "event",
  "treasure", "treasure",
  "merchant", "merchant",
  "rest", "rest",
  "elite",
];
const RECOVERY_TYPES = new Set<RoomType>(["rest", "merchant"]);
const STANDARD_ROOM_TYPES: readonly RoomType[] = ["combat", "event", "treasure", "merchant", "rest", "elite"];
const MAX_ASSIGNMENT_ATTEMPTS = 16;

function shuffle<T>(values: readonly T[], stream: RollStream): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const selected = stream.roll(index + 1) - 1;
    [shuffled[index], shuffled[selected]] = [shuffled[selected]!, shuffled[index]!];
  }
  return shuffled;
}

function connectLayers(current: LayerDraft, next: LayerDraft, stream: RollStream) {
  if (next.nodes.length === 1) {
    current.nodes.forEach((node) => node.nextNodeIds.push(next.nodes[0]!.id));
    return;
  }

  const edges = current.nodes.map(() => new Set<number>());
  current.nodes.forEach((_, index) => {
    edges[index]!.add(Math.min(next.nodes.length - 1, Math.floor(index * next.nodes.length / current.nodes.length)));
  });
  next.nodes.forEach((_, index) => {
    const source = Math.min(current.nodes.length - 1, Math.floor(index * current.nodes.length / next.nodes.length));
    edges[source]!.add(index);
  });

  const branchingSource = stream.roll(current.nodes.length) - 1;
  const existingTarget = [...edges[branchingSource]!][0]!;
  const targetOffset = next.nodes.length === 2 ? 1 : stream.roll(next.nodes.length - 1);
  const adjacentTarget = (existingTarget + targetOffset) % next.nodes.length;
  edges[branchingSource]!.add(adjacentTarget);

  current.nodes.forEach((node, index) => {
    node.nextNodeIds.push(...[...edges[index]!].sort().map((target) => next.nodes[target]!.id));
  });
}

function createTopology(
  stream: RollStream,
  recoveryLayer: number,
  phaseIndex: number,
  roomCount: number,
  legacyIds = false,
): LayerDraft[] {
  const bossLayer = roomCount + 1;
  const layers = Array.from({ length: bossLayer }, (_, offset): LayerDraft => {
    const index = offset + 1;
    const width = index === bossLayer ? 1 : index === recoveryLayer ? 2 : stream.roll(2) + 1;
    return {
      index,
      nodes: Array.from({ length: width }, (_, nodeOffset) => ({
        id: legacyIds
          ? `room-${index}-${nodeOffset + 1}`
          : `phase-${phaseIndex}-room-${index}-${nodeOffset + 1}`,
        type: index === bossLayer ? "boss" : "combat",
        nextNodeIds: [],
      })),
    };
  });

  layers.slice(0, -1).forEach((layer, index) => connectLayers(layer, layers[index + 1]!, stream));
  return layers;
}

function assignFromBag(layers: LayerDraft[], recoveryLayer: number, stream: RollStream) {
  let bag = shuffle(ROOM_BAG, stream);
  const draw = (excluded: ReadonlySet<RoomType>): RoomType => {
    let index = bag.findIndex((type) => !excluded.has(type));
    if (index < 0) {
      bag = shuffle(ROOM_BAG, stream);
      index = bag.findIndex((type) => !excluded.has(type));
    }
    if (index >= 0) return bag.splice(index, 1)[0]!;
    return STANDARD_ROOM_TYPES.find((type) => !excluded.has(type)) ?? "combat";
  };

  for (const [layerOffset, layer] of layers.slice(0, -1).entries()) {
    if (layer.index === recoveryLayer) {
      const recovery = shuffle<RoomType>(["rest", "merchant"], stream);
      layer.nodes.forEach((node, index) => { node.type = recovery[index]!; });
      continue;
    }
    const used = new Set<RoomType>();
    layer.nodes.forEach((node) => {
      const forbidden = new Set<RoomType>(used);
      const previousLayer = layers[layerOffset - 1];
      const beforePreviousLayer = layers[layerOffset - 2];
      const predecessors = previousLayer?.nodes.filter((candidate) => candidate.nextNodeIds.includes(node.id)) ?? [];
      if (predecessors.some((candidate) => candidate.type === "elite")) forbidden.add("elite");
      for (const predecessor of predecessors) {
        const grandPredecessors = beforePreviousLayer?.nodes.filter((candidate) => candidate.nextNodeIds.includes(predecessor.id)) ?? [];
        if (grandPredecessors.some((candidate) => candidate.type === predecessor.type)) {
          forbidden.add(predecessor.type);
        }
      }
      node.type = draw(forbidden);
      used.add(node.type);
    });
  }
}

function isFair(layers: readonly LayerDraft[]): boolean {
  const nodes = new Map(layers.flatMap((layer) => layer.nodes.map((node) => [node.id, node])));
  const reachableWithoutRecovery = new Set(
    layers[0]!.nodes.filter((node) => !RECOVERY_TYPES.has(node.type)).map((node) => node.id),
  );

  for (const layer of layers.slice(0, -1)) {
    for (const node of layer.nodes) {
      for (const nextId of node.nextNodeIds) {
        const next = nodes.get(nextId)!;
        if (node.type === "elite" && next.type === "elite") return false;
        for (const afterId of next.nextNodeIds) {
          const after = nodes.get(afterId)!;
          if (node.type === next.type && next.type === after.type) return false;
        }
        if (reachableWithoutRecovery.has(node.id) && !RECOVERY_TYPES.has(next.type)) {
          reachableWithoutRecovery.add(next.id);
        }
      }
    }
  }

  return !layers.at(-1)!.nodes.some((boss) => reachableWithoutRecovery.has(boss.id));
}

export function createFallbackRoomTypes(
  layerWidths: readonly number[],
  recoveryLayer: number,
): readonly (readonly RoomType[])[] {
  const alternating: readonly (readonly RoomType[])[] = [
    ["combat", "event", "treasure"],
    ["rest", "merchant", "elite"],
  ];
  return layerWidths.map((width, layerOffset) => {
    const layerIndex = layerOffset + 1;
    const types = layerIndex === recoveryLayer
      ? (["rest", "merchant"] as const)
      : alternating[Math.abs(layerIndex - recoveryLayer) % alternating.length === 1 ? 0 : 1]!;
    return Array.from({ length: width }, (_, nodeIndex) => types[nodeIndex % types.length]!);
  });
}

function applyFallback(layers: LayerDraft[], recoveryLayer: number) {
  const assignments = createFallbackRoomTypes(
    layers.slice(0, -1).map((layer) => layer.nodes.length),
    recoveryLayer,
  );
  layers.slice(0, -1).forEach((layer, layerIndex) => {
    layer.nodes.forEach((node, nodeIndex) => { node.type = assignments[layerIndex]![nodeIndex]!; });
  });
}

export function generateMap(input: GenerateMapInput): RunMap;
/** @deprecated Pass a GenerateMapInput. Temporary compatibility defaults to phase 1 with nine rooms. */
export function generateMap(seed: string): RunMap;
export function generateMap(input: GenerateMapInput | string): RunMap {
  const legacySeed = typeof input === "string";
  if (!legacySeed) {
    if (typeof input.seed !== "string" || input.seed.trim().length === 0) {
      throw new Error("seed must not be empty");
    }
    if (!Number.isSafeInteger(input.phaseIndex) || input.phaseIndex < 1 || input.phaseIndex > 7) {
      throw new Error("phaseIndex must be a safe integer between 1 and 7");
    }
    if (!Number.isSafeInteger(input.roomCount) || input.roomCount < 3 || input.roomCount > 9) {
      throw new Error("roomCount must be a safe integer between 3 and 9");
    }
  }
  const { seed, phaseIndex, roomCount } = legacySeed
    ? { seed: input, phaseIndex: 1, roomCount: 9 }
    : input;
  const stream = createNamedRollStream(legacySeed ? seed : `${seed}:phase:${phaseIndex}`, "map");
  const recoveryLayer = roomCount === 3 ? 2 : stream.roll(roomCount - 2) + 1;
  const layers = createTopology(stream, recoveryLayer, phaseIndex, roomCount, legacySeed);

  let valid = false;
  for (let attempt = 0; attempt < MAX_ASSIGNMENT_ATTEMPTS; attempt += 1) {
    assignFromBag(layers, recoveryLayer, stream);
    if (isFair(layers)) {
      valid = true;
      break;
    }
  }
  if (!valid) applyFallback(layers, recoveryLayer);

  return {
    layers: layers.map((layer) => ({
      index: layer.index,
      nodes: layer.nodes.map((node) => ({ ...node, nextNodeIds: [...node.nextNodeIds] })),
    })),
    rngCursor: stream.cursor(),
  };
}
