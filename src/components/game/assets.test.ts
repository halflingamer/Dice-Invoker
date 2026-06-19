import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GAME_ASSETS } from "./assets";

describe("GAME_ASSETS", () => {
  it("maps every renderer key to a shipped public asset", () => {
    for (const source of Object.values(GAME_ASSETS)) {
      expect(source.startsWith("/assets/")).toBe(true);
      expect(existsSync(path.join(process.cwd(), "public", source))).toBe(true);
    }
  });
});
