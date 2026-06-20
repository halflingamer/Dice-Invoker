export const GAME_ASSETS = {
  background: "/assets/environment/arcane-library.png",
  squireIdle: "/assets/characters/squire/idle-strip.png",
  squireAttack: "/assets/characters/squire/attack-strip.png",
  receiptSlime: "/assets/characters/enemies/receipt-slime.png",
  receiptSlimeElite: "/assets/characters/enemies/receipt-slime-elite.png",
  receiptSlimeBoss: "/assets/characters/enemies/receipt-slime-boss.png",
  rustySword: "/assets/items/rusty-sword.png",
  woodenShield: "/assets/items/wooden-shield.png",
  essence: "/assets/items/essence.png",
} as const;

export function dieIcon(dieId: string): string | undefined {
  if (dieId === "rusty-sword") return GAME_ASSETS.rustySword;
  if (dieId === "wooden-shield") return GAME_ASSETS.woodenShield;
  return undefined;
}
