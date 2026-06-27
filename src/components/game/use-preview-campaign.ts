"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { seasonOne } from "@/modules/content/season-1";
import { createCampaignMaps } from "@/modules/game-engine/campaign";
import {
  consumeItem,
  equipItem,
  unequipItem,
  type ConsumableStacks,
  type EquipmentByGuardian,
  type EquipmentSlot,
  type RunItemId,
} from "@/modules/game-engine/economy";
import type { RunMap } from "@/modules/game-engine/map";
import type { RunOutcome } from "@/modules/run/state";

export type CampaignSurface = "map" | "combat" | "merchant" | "treasure" | "event" | "promotion" | "result";

type PreviewCampaignInput = Readonly<{
  seed: string;
  guardianHp?: number;
  initialInventory?: readonly RunItemId[];
  initialConsumables?: ConsumableStacks;
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
  currentRoomId: string | null;
  currentPhaseName: string;
  inventoryOpen: boolean;
  canManageInventory: boolean;
  inventory: readonly RunItemId[];
  consumables: ConsumableStacks;
  equipment: EquipmentByGuardian;
  openInventory(): void;
  closeInventory(): void;
  equip(itemId: RunItemId): void;
  unequip(slot: EquipmentSlot): void;
  useConsumable(itemId: RunItemId): void;
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
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [pendingNextIds, setPendingNextIds] = useState<readonly string[]>([]);
  const [completedRoomCount, setCompletedRoomCount] = useState(0);
  const [guardianHp, setGuardianHp] = useState(input.guardianHp ?? 28);
  const [outcome, setOutcome] = useState<RunOutcome>("ongoing");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventory, setInventory] = useState<readonly RunItemId[]>(input.initialInventory ?? []);
  const [consumables, setConsumables] = useState<ConsumableStacks>(input.initialConsumables ?? {});
  const [equipment, setEquipment] = useState<EquipmentByGuardian>({
    "caretaker-slime": { weapon: null, armor: null, accessory: null },
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentMap = maps[phaseOffset]!.map;
  const currentPhaseName = seasonOne.phases[phaseOffset]?.name ?? "Dungeon";
  const canManageInventory = surface === "map" && outcome === "ongoing";

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
    setInventoryOpen(false);
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

  const openInventory = useCallback(() => {
    if (canManageInventory) setInventoryOpen(true);
  }, [canManageInventory]);

  const closeInventory = useCallback(() => setInventoryOpen(false), []);

  const equip = useCallback((itemId: RunItemId) => {
    if (!canManageInventory) return;
    const next = equipItem({ inventory, consumables, equipment }, "caretaker-slime", itemId);
    setEquipment(next.equipment);
    setInventory(next.inventory);
    setConsumables(next.consumables);
  }, [canManageInventory, consumables, equipment, inventory]);

  const unequip = useCallback((slot: EquipmentSlot) => {
    if (!canManageInventory) return;
    const next = unequipItem({ inventory, consumables, equipment }, "caretaker-slime", slot);
    setEquipment(next.equipment);
  }, [canManageInventory, consumables, equipment, inventory]);

  const useConsumable = useCallback((itemId: RunItemId) => {
    if (!canManageInventory) return;
    const consumed = consumeItem({ inventory, consumables, equipment }, "caretaker-slime", itemId, {
      hp: guardianHp,
      maxHp: 28,
    });
    setConsumables(consumed.inventoryState.consumables);
    setGuardianHp(consumed.guardianHp);
  }, [canManageInventory, consumables, equipment, guardianHp, inventory]);

  const chooseRoom = useCallback((roomId: string) => {
    if (outcome !== "ongoing" || !availableRoomIds.includes(roomId)) return;
    const node = currentMap.layers.flatMap((layer) => layer.nodes).find((candidate) => candidate.id === roomId);
    if (!node) return;
    setCurrentRoomId(roomId);
    setInventoryOpen(false);
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
      setCurrentRoomId(null);
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
    currentRoomId,
    currentPhaseName,
    inventoryOpen,
    canManageInventory,
    inventory,
    consumables,
    equipment,
    openInventory,
    closeInventory,
    equip,
    unequip,
    useConsumable,
    chooseRoom,
    resolveRoomForTest,
    startCombatForTest,
  };
}
