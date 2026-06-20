import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useAutoCombat } from "./use-auto-combat";

function Harness({ encounterId = "room-1-1", enemyRank = "elite", initialEnemyHp = 20, onHeroHpChange }: Readonly<{
  encounterId?: string | null;
  enemyRank?: "normal" | "elite" | "boss";
  initialEnemyHp?: number;
  onHeroHpChange?(heroHp: number): void;
}>) {
  const combat = useAutoCombat({
    encounterId, initialEnemyHp, initialHeroHp: 10, sides: 4, enemyRank,
    onHeroHpChange, onVictory: () => undefined,
  });
  return <div><span>{combat.phase}</span><span>HP {combat.enemyHp}</span><span>Hero {combat.heroHp}</span><span>Dano {combat.damage.value}</span><span>Inimigo D{combat.enemyAttack.sides}: {combat.enemyAttack.result}</span><span>{combat.message}</span></div>;
}

describe("useAutoCombat", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  const resolveOneTurn = () => {
    act(() => vi.advanceTimersByTime(650));
    act(() => vi.advanceTimersByTime(2_500));
    act(() => vi.advanceTimersByTime(250));
  };

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

  it.each([
    ["normal", 4], ["elite", 6], ["boss", 8],
  ] as const)("uses a %s enemy attack die", (enemyRank, sides) => {
    const { container } = render(<Harness enemyRank={enemyRank} />);
    expect(within(container).getByText(new RegExp(`Inimigo D${sides}: [1-${sides}]`))).toBeInTheDocument();
  });

  it("resolves damage, block, and damage received in the same cycle", () => {
    render(<Harness enemyRank="boss" />);
    resolveOneTurn();
    expect(screen.getByText(/causou \d+; defesa bloqueou \d+; recebeu \d+/i)).toBeInTheDocument();
    expect(screen.getByText(/Hero [0-9]+/)).toBeInTheDocument();
  });

  it("does not take enemy damage when the hero wins", () => {
    render(<Harness enemyRank="boss" initialEnemyHp={1} />);
    resolveOneTurn();
    expect(screen.getByText("Hero 10")).toBeInTheDocument();
    expect(screen.getByText(/recebeu 0/i)).toBeInTheDocument();
  });

  it("reports resolved hero HP to the presentation owner", () => {
    const onHeroHpChange = vi.fn();
    render(<Harness enemyRank="boss" onHeroHpChange={onHeroHpChange} />);
    resolveOneTurn();
    expect(onHeroHpChange).toHaveBeenCalledWith(8);
  });

  it("starts the next encounter from the HP persisted by its owner", () => {
    function Owner() {
      const [encounterId, setEncounterId] = useState("first");
      const [heroHp, setHeroHp] = useState(10);
      const combat = useAutoCombat({
        encounterId, initialEnemyHp: 20, initialHeroHp: heroHp, sides: 4,
        enemyRank: "boss", onHeroHpChange: setHeroHp, onVictory: () => undefined,
      });
      return <div><span>Hero {combat.heroHp}</span><button onClick={() => setEncounterId("second")}>Próximo</button></div>;
    }

    render(<Owner />);
    resolveOneTurn();
    expect(screen.getByText("Hero 8")).toBeInTheDocument();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Próximo" })));
    expect(screen.getByText("Hero 8")).toBeInTheDocument();
  });
});
