import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GAME_ASSETS } from "./assets";

describe("GAME_ASSETS", () => {
  it("declares separate receipt slime art for elite and boss encounters", () => {
    expect(GAME_ASSETS.receiptSlimeElite).toBe("/assets/characters/enemies/receipt-slime-elite.png");
    expect(GAME_ASSETS.receiptSlimeBoss).toBe("/assets/characters/enemies/receipt-slime-boss.png");
  });

  it("maps every renderer key to a shipped public asset", () => {
    for (const source of Object.values(GAME_ASSETS)) {
      expect(source.startsWith("/assets/")).toBe(true);
      expect(existsSync(path.join(process.cwd(), "public", source))).toBe(true);
    }
  });
});
