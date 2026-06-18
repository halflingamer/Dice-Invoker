import { describe, expect, it } from "vitest";
import { loadSeason } from "./content-loader";
import { seasonOne } from "./season-1";

describe("loadSeason", () => {
  it("accepts unique ids and exact face counts", () => {
    const season = loadSeason(seasonOne);

    expect(season.id).toBe("season-1");
    expect(season.heroes[0]?.id).toBe("squire");
    expect(season.dice.every((die) => die.faces.length === die.sides)).toBe(true);
  });

  it("rejects duplicate dice ids", () => {
    expect(() =>
      loadSeason({
        ...seasonOne,
        dice: [seasonOne.dice[0], seasonOne.dice[0]],
      }),
    ).toThrow(/duplicate die id/i);
  });

  it("rejects unknown fields", () => {
    expect(() => loadSeason({ ...seasonOne, injectedRule: "always-win" })).toThrow();
  });
});
