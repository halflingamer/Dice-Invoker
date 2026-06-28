import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PhaserBattle } from "./PhaserBattle";

vi.mock("phaser", () => ({
  AUTO: "AUTO",
  Scale: { FIT: "FIT", CENTER_BOTH: "CENTER_BOTH" },
  Scene: class Scene {},
  Game: class Game {
    destroy() {}
  },
  default: {
    AUTO: "AUTO",
    Scale: { FIT: "FIT", CENTER_BOTH: "CENTER_BOTH" },
    Scene: class Scene {},
    Game: class Game {
      destroy() {}
    },
  },
}));

it("presents the dungeon guardian fighting an invading adventurer", () => {
  render(<PhaserBattle event={null} guardianName="Slime Zelador" invaderName="Escudeiro Invasor" />);

  expect(screen.getByLabelText("Campo de batalha: Slime Zelador contra Escudeiro Invasor")).toBeInTheDocument();
});
