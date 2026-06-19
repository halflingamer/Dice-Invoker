import { createRollStream } from "./rng";

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

const STANDARD_ROOM_TYPES: readonly RoomType[] = ["combat", "combat", "treasure", "merchant", "event", "rest", "elite"];
const NINTH_LAYER_TYPES: readonly RoomType[] = ["combat", "treasure", "merchant", "event", "rest"];

function roomTypeFor(layer: number, roll: (sides: number) => number): RoomType {
  if (layer === 5) return "elite";
  if (layer === 10) return "boss";
  const types = layer === 9 ? NINTH_LAYER_TYPES : STANDARD_ROOM_TYPES;
  return types[roll(types.length) - 1]!;
}

export function generateMap(seed: string): RunMap {
  const stream = createRollStream(seed);
  const layerDrafts = Array.from({ length: 10 }, (_, offset) => {
    const layer = offset + 1;
    const width = layer === 1 || layer === 10 ? 1 : layer === 2 ? 2 : stream.roll(2);
    return {
      index: layer,
      nodes: Array.from({ length: width }, (_, nodeOffset) => ({
        id: `room-${layer}-${nodeOffset + 1}`,
        type: roomTypeFor(layer, (sides) => stream.roll(sides)),
      })),
    };
  });

  const layers = layerDrafts.map((layer, index): MapLayer => {
    const nextNodeIds = layerDrafts[index + 1]?.nodes.map((node) => node.id) ?? [];
    return {
      index: layer.index,
      nodes: layer.nodes.map((node) => ({ ...node, nextNodeIds: [...nextNodeIds] })),
    };
  });

  return { layers, rngCursor: stream.cursor() };
}
