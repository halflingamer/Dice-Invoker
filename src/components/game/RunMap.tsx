"use client";

import { useMemo } from "react";
import type { RunMap as RunMapModel } from "@/modules/game-engine/map";
import { LocationDie, type LocationState } from "./LocationDie";

const MAP_WIDTH = 240;
const LAYER_HEIGHT = 76;
const X_BY_WIDTH: Record<number, readonly number[]> = {
  1: [120],
  2: [76, 164],
  3: [42, 120, 198],
};

type Position = Readonly<{ x: number; y: number }>;

export function RunMap({
  map,
  availableRoomIds,
  visitedRoomIds,
  currentRoomId,
  onChoose,
}: Readonly<{
  map: RunMapModel;
  availableRoomIds: readonly string[];
  visitedRoomIds: readonly string[];
  currentRoomId: string | null;
  onChoose(id: string): void;
}>) {
  const available = useMemo(() => new Set(availableRoomIds), [availableRoomIds]);
  const visited = useMemo(() => new Set(visitedRoomIds), [visitedRoomIds]);
  const currentLayer = currentRoomId
    ? map.layers.find((layer) => layer.nodes.some((node) => node.id === currentRoomId))?.index ?? 0
    : 0;
  const height = map.layers.length * LAYER_HEIGHT + 24;
  const positions = useMemo(() => {
    const result = new Map<string, Position>();
    for (const layer of map.layers) {
      const xs = X_BY_WIDTH[layer.nodes.length] ?? X_BY_WIDTH[3]!;
      const y = (map.layers.length - layer.index) * LAYER_HEIGHT + 18;
      layer.nodes.forEach((node, index) => result.set(node.id, { x: xs[index]!, y }));
    }
    return result;
  }, [map]);

  const stateFor = (id: string, layerIndex: number): LocationState => {
    if (id === currentRoomId) return "selected";
    if (visited.has(id)) return "completed";
    if (available.has(id)) return "reachable";
    if (layerIndex <= currentLayer) return "lost";
    return "locked";
  };

  return (
    <aside className="run-map" aria-label="Mapa da run">
      <header className="run-map-title">
        <h2>Dados de Local</h2>
        <span>{currentLayer}/10</span>
      </header>
      <div className="route-scroll">
        <div className="route-graph" style={{ width: MAP_WIDTH, height }}>
          <svg className="route-lines" viewBox={`0 0 ${MAP_WIDTH} ${height}`} aria-hidden="true">
            {map.layers.flatMap((layer) => layer.nodes.flatMap((node) => {
              const from = positions.get(node.id)!;
              return node.nextNodeIds.map((nextId) => {
                const to = positions.get(nextId)!;
                const active = visited.has(node.id) && (visited.has(nextId) || available.has(nextId));
                return (
                  <path
                    key={`${node.id}-${nextId}`}
                    className={`route-line${active ? " is-active" : ""}`}
                    d={`M ${from.x} ${from.y + 25} C ${from.x} ${from.y + 48}, ${to.x} ${to.y - 22}, ${to.x} ${to.y - 2}`}
                  />
                );
              });
            }))}
          </svg>
          {map.layers.flatMap((layer) => layer.nodes.map((node) => {
            const position = positions.get(node.id)!;
            return (
              <LocationDie
                key={node.id}
                id={node.id}
                type={node.type}
                state={stateFor(node.id, layer.index)}
                x={position.x}
                y={position.y}
                onChoose={onChoose}
              />
            );
          }))}
        </div>
      </div>
    </aside>
  );
}
