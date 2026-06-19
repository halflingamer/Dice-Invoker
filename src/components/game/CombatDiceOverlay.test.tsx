import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CombatDiceOverlay } from "./CombatDiceOverlay";

describe("CombatDiceOverlay", () => {
  it("shows only damage and defense dice and rerolls during intervention", () => {
    const onReroll = vi.fn();
    render(
      <CombatDiceOverlay
        phase="intervention"
        damage={{ kind: "damage", sides: 4, value: 3, label: "Golpe", faceIndex: 3, healing: 0 }}
        defense={{ kind: "defense", sides: 4, value: 2, label: "Aparar", faceIndex: 2, healing: 0 }}
        essence={2}
        onReroll={onReroll}
      />,
    );

    expect(screen.getByLabelText(/Dado de dano D4, resultado 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Dado de defesa D4, resultado 2/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Rerrolar dano/i }));
    expect(onReroll).toHaveBeenCalledWith("damage");
  });

  it("does not offer rerolls while dice are moving", () => {
    const { container } = render(
      <CombatDiceOverlay
        phase="rolling"
        damage={{ kind: "damage", sides: 6, value: 4, label: "Golpe", faceIndex: 4, healing: 0 }}
        defense={{ kind: "defense", sides: 6, value: 5, label: "Muralha", faceIndex: 5, healing: 0 }}
        essence={2}
        onReroll={() => undefined}
      />,
    );

    expect(within(container).queryByRole("button", { name: /Rerrolar/i })).not.toBeInTheDocument();
  });
});
