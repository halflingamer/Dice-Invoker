import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoCombat } from "./use-auto-combat";

function Harness({ encounterId = "room-1-1" }: Readonly<{ encounterId?: string | null }>) {
  const combat = useAutoCombat({ encounterId, initialEnemyHp: 20, sides: 4, onVictory: () => undefined });
  return <div><span>{combat.phase}</span><span>HP {combat.enemyHp}</span><span>Dano {combat.damage.value}</span></div>;
}

describe("useAutoCombat", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("rolls, pauses, resolves, presents, and starts the next turn automatically", () => {
    render(<Harness />);
    expect(screen.getByText("rolling")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByText("intervention")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2_500));
    expect(screen.getByText("resolving")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByText("presenting")).toBeInTheDocument();
    expect(screen.getByText(/HP 1[0-9]/)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByText("rolling")).toBeInTheDocument();
  });

  it("stays idle when there is no combat encounter", () => {
    render(<Harness encounterId={null} />);
    expect(screen.getByText("idle")).toBeInTheDocument();
  });
});
