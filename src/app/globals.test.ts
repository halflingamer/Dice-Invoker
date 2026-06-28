import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("lets the central campaign map fill the combat column instead of a single grid row", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  expect(css).toMatch(/\.battle-column>\.campaign-map-surface\{[^}]*grid-row:1\/-1/);
});
