import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromotionChoice } from "./PromotionChoice";

describe("PromotionChoice", () => {
  it("compares two legal classes and submits only the chosen id", () => {
    const onChoose = vi.fn();
    render(
      <PromotionChoice
        currentDie="D4"
        options={[
          { id: "warrior-d6", name: "Guerreiro", die: "D6", role: "Ataque", summary: "Mais dano" },
          { id: "guardian-d6", name: "Guardião", die: "D6", role: "Defesa", summary: "Mais bloqueio" },
        ]}
        onChoose={onChoose}
      />,
    );

    expect(screen.getAllByText("D6")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Escolher Guardião/i }));
    expect(onChoose).toHaveBeenCalledWith("guardian-d6");
  });
});
