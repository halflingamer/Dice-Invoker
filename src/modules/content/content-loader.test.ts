import { describe, expect, it } from "vitest";
import { loadSeason } from "./content-loader";
import { seasonOne } from "./season-1";

describe("loadSeason", () => {
  it("accepts unique ids and exact face counts", () => {
    const season = loadSeason(seasonOne);

    expect(season.id).toBe("season-1");
    expect(season.heroes[0]?.id).toBe("squire");
    expect(season.dice.every((die) => die.faces.length === die.sides)).toBe(true);
    expect(season.classStages.every((stage) => stage.faces.length === stage.sides)).toBe(true);
    expect(season.heroes.find((hero) => hero.id === "squire")?.rootClassStageId).toBe("squire-d4");
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

  it("rejects missing class children", () => {
    const root = seasonOne.classStages.find((stage) => stage.id === "squire-d4")!;
    expect(() => loadSeason({
      ...seasonOne,
      classStages: seasonOne.classStages.map((stage) => stage.id === root.id
        ? { ...stage, nextStageIds: ["forged-class", root.nextStageIds[1]!] }
        : stage),
    })).toThrow(/unknown class stage/i);
  });

  it("rejects skipped die sizes in a class tree", () => {
    const warrior = seasonOne.classStages.find((stage) => stage.id === "warrior-d6")!;
    const extraFaces = [
      { ...warrior.faces[0]!, id: "warrior-forged-7" },
      { ...warrior.faces[1]!, id: "warrior-forged-8" },
    ];
    expect(() => loadSeason({
      ...seasonOne,
      classStages: seasonOne.classStages.map((stage) => stage.id === warrior.id
        ? { ...stage, sides: 8, faces: [...stage.faces, ...extraFaces] }
        : stage),
    })).toThrow(/die size/i);
  });

  it("rejects cycles in a class tree", () => {
    const terminal = seasonOne.classStages.find((stage) => stage.id === "storm-of-steel-d12")!;
    expect(() => loadSeason({
      ...seasonOne,
      classStages: seasonOne.classStages.map((stage) => stage.id === terminal.id
        ? { ...stage, nextStageIds: ["squire-d4", "fate-duelist-d12"] }
        : stage),
    })).toThrow(/cycle/i);
  });
});
