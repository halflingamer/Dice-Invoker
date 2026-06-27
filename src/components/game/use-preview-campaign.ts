"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { seasonOne } from "@/modules/content/season-1";
import { createCampaignMaps } from "@/modules/game-engine/campaign";
import type { RunMap } from "@/modules/game-engine/map";
import type { RunOutcome } from "@/modules/run/state";

export type CampaignSurface = "map" | "combat" | "merchant" | "treasure" | "event" | "promotion" | "result";

type PreviewCampaignInput = Readonly<{
  seed: string;
  guardianHp?: number;
}>;

type CombatTestInput = Readonly<{
  invaderAttack: number;
}>;

export type PreviewCampaignView = Readonly<{
  surface: CampaignSurface;
  campaignPhaseIndex: number;
  currentMap: RunMap;
  availableRoomIds: readonly string[];
  visitedRoomIds: readonly string[];
  completedRoomCount: number;
  outcome: RunOutcome;
  chooseRoom(roomId: string): void;
  resolveRoomForTest(): void;
  startCombatForTest(input: CombatTestInput): void;
}>;

export function usePreviewCampaign(input: PreviewCampaignInput): PreviewCampaignView {
  const maps = useMemo(() => createCampaignMaps(input.seed, seasonOne.phases), [input.seed]);
  const [phaseOffset, setPhaseOffset] = useState(0);
  const [surface, setSurface] = useState<CampaignSurface>("map");
  const [availableRoomIds, setAvailableRoomIds] = useState<readonly string[]>(() =>
    maps[0]!.map.layers[0]!.nodes.map((node) => node.id),
  );
  const [visitedRoomIds, setVisitedRoomIds] = useState<readonly string[]>([]);
  const [pendingNextIds, setPendingNextIds] = useState<readonly string[]>([]);
  const [completedRoomCount, setCompletedRoomCount] = useState(0);
  const [guardianHp, setGuardianHp] = useState(input.guardianHp ?? 28);
  const [outcome, setOutcome] = useState<RunOutcome>("ongoing");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentMap = maps[phaseOffset]!.map;

  const clearCombatTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearCombatTimer, [clearCombatTimer]);

  const endWithDefeat = useCallback(() => {
    clearCombatTimer();
    setGuardianHp(0);
    setOutcome("defeat");
    setSurface("result");
    setAvailableRoomIds([]);
    setPendingNextIds([]);
  }, [clearCombatTimer]);

  const resolveRoomForTest = useCallback(() => {
    if (outcome !== "ongoing") return;
    clearCombatTimer();
    setSurface("map");
    setAvailableRoomIds([...pendingNextIds]);
    setPendingNextIds([]);
  }, [clearCombatTimer, outcome, pendingNextIds]);

  const chooseRoom = useCallback((roomId: string) => {
    if (outcome !== "ongoing" || !availableRoomIds.includes(roomId)) return;
    const node = currentMap.layers.flatMap((layer) => layer.nodes).find((candidate) => candidate.id === roomId);
    if (!node) return;
    setVisitedRoomIds((current) => [...current, roomId]);
    setCompletedRoomCount((current) => current + 1);
    setPendingNextIds([...node.nextNodeIds]);
    setAvailableRoomIds([]);
    if (node.type === "boss" && phaseOffset === maps.length - 1) {
      setOutcome("victory");
      setSurface("result");
      return;
    }
    if (node.type === "boss") {
      const nextOffset = phaseOffset + 1;
      const nextMap = maps[nextOffset]!.map;
      setPhaseOffset(nextOffset);
      setVisitedRoomIds([]);
      setCompletedRoomCount(0);
      setPendingNextIds([]);
      setAvailableRoomIds(nextMap.layers[0]!.nodes.map((nextNode) => nextNode.id));
      setSurface("map");
      return;
    }
    if (node.type === "rest") {
      setSurface("map");
      setAvailableRoomIds([...node.nextNodeIds]);
      setPendingNextIds([]);
      return;
    }
    setSurface(node.type === "combat" || node.type === "elite" ? "combat" : node.type);
  }, [availableRoomIds, currentMap, maps, outcome, phaseOffset]);

  const startCombatForTest = useCallback((combat: CombatTestInput) => {
    if (outcome !== "ongoing") return;
    clearCombatTimer();
    setSurface("combat");
    timerRef.current = setTimeout(() => {
      setGuardianHp((current) => {
        const next = Math.max(0, current - combat.invaderAttack);
        if (next === 0) endWithDefeat();
        else {
          setSurface("map");
          setAvailableRoomIds((currentAvailable) => currentAvailable.length > 0 ? currentAvailable : [...pendingNextIds]);
        }
        return next;
      });
      timerRef.current = null;
    }, 1);
  }, [clearCombatTimer, endWithDefeat, outcome, pendingNextIds]);

  useEffect(() => {
    if (guardianHp === 0 && outcome === "ongoing") endWithDefeat();
  }, [endWithDefeat, guardianHp, outcome]);

  return {
    surface,
    campaignPhaseIndex: phaseOffset + 1,
    currentMap,
    availableRoomIds,
    visitedRoomIds,
    completedRoomCount,
    outcome,
    chooseRoom,
    resolveRoomForTest,
    startCombatForTest,
  };
}
