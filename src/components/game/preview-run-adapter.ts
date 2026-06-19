import type { RoomType, RunMap } from "@/modules/game-engine/map";

const PREVIEW_TYPES: readonly RoomType[][] = [
  ["combat", "event", "treasure"],
  ["rest", "combat"],
  ["elite", "merchant", "event"],
  ["combat", "treasure"],
  ["rest", "event", "combat"],
  ["merchant", "elite"],
  ["combat", "event", "treasure"],
  ["rest", "combat"],
  ["elite", "merchant", "event"],
];

export const previewRunMap: RunMap = {
  rngCursor: 0,
  layers: [
    ...PREVIEW_TYPES.map((types, layerOffset) => {
      const index = layerOffset + 1;
      const nextWidth = PREVIEW_TYPES[layerOffset + 1]?.length ?? 1;
      return {
        index,
        nodes: types.map((type, nodeOffset) => ({
          id: `room-${index}-${nodeOffset + 1}`,
          type,
          nextNodeIds: [
            `room-${index + 1}-${Math.min(nodeOffset, nextWidth - 1) + 1}`,
            ...(nextWidth > 1 && nodeOffset === 0 ? [`room-${index + 1}-2`] : []),
          ].filter((id, position, ids) => ids.indexOf(id) === position),
        })),
      };
    }),
    { index: 10, nodes: [{ id: "room-10-1", type: "boss", nextNodeIds: [] }] },
  ],
};
