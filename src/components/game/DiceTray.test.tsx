import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DiceTray } from "./DiceTray";

it("locks a die and permits reroll while essence remains", () => {
  const onLock = vi.fn();
  const onReroll = vi.fn();
  const { container } = render(<DiceTray dice={[{ id: "rusty-sword", name: "Espada Enferrujada", face: "Corte", value: 5, locked: false }, { id: "wooden-shield", name: "Escudo de Madeira", face: "Aparar", value: 2, locked: false }]} essence={1} busy={false} onLock={onLock} onReroll={onReroll} onActivate={vi.fn()} />);
  expect([...container.querySelectorAll(".die-label img")].every((image) => image.getAttribute("width") === "34")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /travar corte/i }));
  expect(onLock).toHaveBeenCalledWith("rusty-sword");
  expect(screen.getByRole("button", { name: /rerrolar/i })).toBeEnabled();
});
