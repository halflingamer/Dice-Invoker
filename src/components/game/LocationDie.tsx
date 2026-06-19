"use client";

import type { RoomType } from "@/modules/game-engine/map";

export type LocationState = "locked" | "reachable" | "selected" | "completed" | "lost";

const ROOM_PRESENTATION: Record<RoomType, Readonly<{ label: string; symbol: string }>> = {
  combat: { label: "Combate", symbol: "⚔" },
  elite: { label: "Elite", symbol: "☠" },
  treasure: { label: "Tesouro", symbol: "▣" },
  merchant: { label: "Mercador", symbol: "⚖" },
  event: { label: "Evento", symbol: "?" },
  rest: { label: "Descanso", symbol: "♨" },
  boss: { label: "Chefão", symbol: "♛" },
};

const STATE_LABEL: Record<LocationState, string> = {
  locked: "bloqueado",
  reachable: "alcançável",
  selected: "selecionado",
  completed: "concluído",
  lost: "rota perdida",
};

export function LocationDie({
  id,
  type,
  state,
  x,
  y,
  onChoose,
}: Readonly<{
  id: string;
  type: RoomType;
  state: LocationState;
  x: number;
  y: number;
  onChoose(id: string): void;
}>) {
  const presentation = ROOM_PRESENTATION[type];
  return (
    <button
      type="button"
      className={`location-die location-${type} is-${state}`}
      style={{ left: x, top: y }}
      disabled={state !== "reachable"}
      aria-label={`${presentation.label}, ${STATE_LABEL[state]}`}
      onClick={() => onChoose(id)}
    >
      <span aria-hidden="true">{presentation.symbol}</span>
      <small>{presentation.label}</small>
    </button>
  );
}
