import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePreviewCampaign } from "./use-preview-campaign";

afterEach(() => {
  vi.useRealTimers();
});

describe("usePreviewCampaign", () => {
  it("returns to the map after a room resolves", () => {
    const { result } = renderHook(() => usePreviewCampaign({ seed: "preview-seed" }));

    act(() => result.current.chooseRoom(result.current.availableRoomIds[0]!));
    act(() => result.current.resolveRoomForTest());

    expect(result.current.surface).toBe("map");
    expect(result.current.availableRoomIds.length).toBeGreaterThanOrEqual(1);
  });

  it("stops every combat timer on defeat", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => usePreviewCampaign({ seed: "defeat-seed", guardianHp: 1 }));

    act(() => result.current.startCombatForTest({ invaderAttack: 20 }));
    act(() => vi.runAllTimers());

    expect(result.current.outcome).toBe("defeat");
    const roomCount = result.current.completedRoomCount;
    act(() => vi.runAllTimers());
    expect(result.current.completedRoomCount).toBe(roomCount);

    unmount();
  });

  it("manages inventory only on the map surface", () => {
    const { result } = renderHook(() => usePreviewCampaign({
      seed: "inventory-seed",
      initialInventory: ["sharp-sword"],
    }));

    act(() => result.current.openInventory());
    expect(result.current.inventoryOpen).toBe(true);

    act(() => result.current.equip("sharp-sword"));
    expect(result.current.equipment["caretaker-slime"]?.weapon).toBe("sharp-sword");

    act(() => result.current.chooseRoom(result.current.availableRoomIds[0]!));
    expect(result.current.canManageInventory).toBe(false);
    act(() => result.current.unequip("weapon"));
    expect(result.current.equipment["caretaker-slime"]?.weapon).toBe("sharp-sword");
  });
});
