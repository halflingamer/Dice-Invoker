import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InventoryDrawer } from "./InventoryDrawer";

const equipment = {
  "caretaker-slime": { weapon: "sharp-sword" as const, armor: null, accessory: null },
};

afterEach(cleanup);

describe("InventoryDrawer", () => {
  it("renders one slot per equipment type and four locked guardian cards", () => {
    render(
      <InventoryDrawer
        open
        canManage
        guardianId="caretaker-slime"
        inventory={["sharp-sword", "reinforced-shield"]}
        consumables={{ "healing-potion": 2 }}
        equipment={equipment}
        onClose={() => undefined}
        onEquip={() => undefined}
        onUnequip={() => undefined}
        onUseConsumable={() => undefined}
      />,
    );

    expect(screen.getByRole("dialog", { name: "InventÃ¡rio da Dungeon" })).toBeVisible();
    expect(screen.getByText("Arma")).toBeVisible();
    expect(screen.getByText("Armadura")).toBeVisible();
    expect(screen.getByText("AcessÃ³rio")).toBeVisible();
    expect(screen.getAllByText("Bloqueado")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Desequipar Espada/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Equipar Escudo/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Usar Po/i })).toBeEnabled();
  });

  it("disables actions outside the map surface", () => {
    const onEquip = vi.fn();
    render(
      <InventoryDrawer
        open
        canManage={false}
        guardianId="caretaker-slime"
        inventory={["reinforced-shield"]}
        consumables={{}}
        equipment={{ "caretaker-slime": { weapon: null, armor: null, accessory: null } }}
        onClose={() => undefined}
        onEquip={onEquip}
        onUnequip={() => undefined}
        onUseConsumable={() => undefined}
      />,
    );

    const equip = screen.getByRole("button", { name: /Equipar Escudo/i });
    expect(equip).toBeDisabled();
    fireEvent.click(equip);
    expect(onEquip).not.toHaveBeenCalled();
  });

  it("returns null when closed", () => {
    const { container } = render(
      <InventoryDrawer
        open={false}
        canManage
        guardianId="caretaker-slime"
        inventory={[]}
        consumables={{}}
        equipment={{ "caretaker-slime": { weapon: null, armor: null, accessory: null } }}
        onClose={() => undefined}
        onEquip={() => undefined}
        onUnequip={() => undefined}
        onUseConsumable={() => undefined}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
