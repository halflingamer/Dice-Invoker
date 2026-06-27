"use client";

import {
  RUN_ITEMS,
  type ConsumableStacks,
  type EquipmentByGuardian,
  type EquipmentSlot,
  type RunItemId,
} from "@/modules/game-engine/economy";

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: "Arma",
  armor: "Armadura",
  accessory: "AcessÃ³rio",
};

const LOCKED_GUARDIANS = ["Morcego Porteiro", "Mímico Sindical", "Golem Faxineiro", "DragÃ£o EstagiÃ¡rio"] as const;

function itemSummary(itemId: RunItemId): string {
  const item = RUN_ITEMS[itemId];
  const effect = item.effect;
  if ("attack" in effect) return `+${effect.attack} ataque`;
  if ("defense" in effect) return `+${effect.defense} defesa`;
  if ("heal" in effect) return `cura ${effect.heal}`;
  if ("goldPercent" in effect) return `+${effect.goldPercent}% ouro`;
  return "efeito desconhecido";
}

export function InventoryDrawer({
  open,
  canManage,
  guardianId,
  inventory,
  consumables,
  equipment,
  onClose,
  onEquip,
  onUnequip,
  onUseConsumable,
}: Readonly<{
  open: boolean;
  canManage: boolean;
  guardianId: string;
  inventory: readonly RunItemId[];
  consumables: ConsumableStacks;
  equipment: EquipmentByGuardian;
  onClose(): void;
  onEquip(itemId: RunItemId): void;
  onUnequip(slot: EquipmentSlot): void;
  onUseConsumable(itemId: RunItemId): void;
}>) {
  if (!open) return null;

  const equipped = equipment[guardianId] ?? { weapon: null, armor: null, accessory: null };
  const equippedIds = new Set(Object.values(equipped).filter(Boolean));
  const ownedItems = inventory.filter((itemId) => RUN_ITEMS[itemId].kind === "passive");
  const consumableEntries = Object.entries(consumables)
    .filter((entry): entry is [RunItemId, number] => entry[1] !== undefined && entry[1] > 0);

  return (
    <aside className="inventory-drawer" role="dialog" aria-modal="false" aria-label="InventÃ¡rio da Dungeon">
      <header className="inventory-header">
        <div>
          <span>Mapa da Dungeon</span>
          <h2>InventÃ¡rio</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar inventÃ¡rio">Ã—</button>
      </header>

      <section className="inventory-section" aria-label="Equipamentos do guardiÃ£o">
        <h3>Slime Zelador</h3>
        <div className="equipment-slots">
          {(["weapon", "armor", "accessory"] as const).map((slot) => {
            const itemId = equipped[slot];
            return (
              <article className="equipment-slot" key={slot}>
                <span>{SLOT_LABELS[slot]}</span>
                <strong>{itemId ? RUN_ITEMS[itemId].name : "Vazio"}</strong>
                {itemId ? <small>{itemSummary(itemId)}</small> : <small>Sem bÃ´nus equipado</small>}
                <button
                  type="button"
                  disabled={!canManage || itemId === null}
                  onClick={() => itemId && onUnequip(slot)}
                  aria-label={itemId ? `Desequipar ${RUN_ITEMS[itemId].name}` : `Desequipar ${SLOT_LABELS[slot]}`}
                >
                  Desequipar
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="inventory-section" aria-label="Itens guardados">
        <h3>Itens</h3>
        {ownedItems.length === 0 ? <p className="inventory-empty">Nenhum item passivo guardado.</p> : null}
        <div className="inventory-items">
          {ownedItems.map((itemId) => {
            const item = RUN_ITEMS[itemId];
            const equippedAlready = equippedIds.has(itemId);
            return (
              <article className="inventory-item" key={itemId}>
                <strong>{item.name}</strong>
                <small>{SLOT_LABELS[item.slot as EquipmentSlot]} Â· {itemSummary(itemId)}</small>
                <button
                  type="button"
                  disabled={!canManage || equippedAlready}
                  onClick={() => onEquip(itemId)}
                  aria-label={`Equipar ${item.name}`}
                >
                  {equippedAlready ? "Equipado" : "Equipar"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="inventory-section" aria-label="ConsumÃ­veis">
        <h3>ConsumÃ­veis</h3>
        {consumableEntries.length === 0 ? <p className="inventory-empty">Nenhum consumÃ­vel.</p> : null}
        <div className="inventory-items">
          {consumableEntries.map(([itemId, count]) => (
            <article className="inventory-item" key={itemId}>
              <strong>{RUN_ITEMS[itemId].name} Ã—{count}</strong>
              <small>{itemSummary(itemId)}</small>
              <button
                type="button"
                disabled={!canManage}
                onClick={() => onUseConsumable(itemId)}
                aria-label={`Usar ${RUN_ITEMS[itemId].name}`}
              >
                Usar
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="inventory-section" aria-label="GuardiÃµes bloqueados">
        <h3>GuardiÃµes</h3>
        <div className="locked-guardians">
          {LOCKED_GUARDIANS.map((name) => (
            <article className="locked-guardian" key={name}>
              <strong>{name}</strong>
              <span>Bloqueado</span>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}
