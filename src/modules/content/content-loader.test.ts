import { describe, expect, it } from "vitest";
import { loadSeason } from "./content-loader";
import { seasonOne } from "./season-1";

describe("loadSeason", () => {
  it("loads the dungeon-defense season progression", () => {
    const season = loadSeason(seasonOne);

    expect(season.guardians[0]).toMatchObject({
      id: "caretaker-slime",
      name: "Slime Zelador",
      unlock: { kind: "starter" },
    });
    expect(season.evolutionStages.some((stage) => stage.sides === 20)).toBe(true);
    expect(season.evolutionStages.every((stage) => stage.naturalDefense >= 0)).toBe(true);
    expect(season.phases.map((phase) => phase.roomCount)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(season.phases.map((phase) => phase.difficulty)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(season.phases.map((phase) => phase.bossInvaderId)).size).toBe(7);
  });

  it("accepts unique ids and exact face counts", () => {
    const season = loadSeason(seasonOne);

    expect(season.id).toBe("season-1");
    expect(season.guardians[0]?.id).toBe("caretaker-slime");
    expect(season.dice.every((die) => die.faces.length === die.sides)).toBe(true);
    expect(season.evolutionStages.every((stage) => stage.naturalDefense >= 0)).toBe(true);
    expect(season.guardians[0]?.rootEvolutionStageId).toBe("caretaker-slime-d4");
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

  it("rejects missing evolution children", () => {
    const root = seasonOne.evolutionStages.find((stage) => stage.id === "caretaker-slime-d4")!;
    expect(() => loadSeason({
      ...seasonOne,
      evolutionStages: seasonOne.evolutionStages.map((stage) => stage.id === root.id
        ? { ...stage, nextStageIds: ["forged-stage", root.nextStageIds[1]!] }
        : stage),
    })).toThrow(/unknown evolution stage/i);
  });

  it("rejects skipped die sizes in an evolution tree", () => {
    const stage = seasonOne.evolutionStages.find((candidate) => candidate.id === "caretaker-slime-d6-1")!;
    expect(() => loadSeason({
      ...seasonOne,
      evolutionStages: seasonOne.evolutionStages.map((candidate) => candidate.id === stage.id
        ? { ...candidate, sides: 8 as const }
        : candidate),
    })).toThrow(/die size|orphan/i);
  });

  it("rejects cycles in an evolution tree", () => {
    const terminal = seasonOne.evolutionStages.find((stage) => stage.sides === 20)!;
    expect(() => loadSeason({
      ...seasonOne,
      evolutionStages: seasonOne.evolutionStages.map((stage) => stage.id === terminal.id
        ? { ...stage, nextStageIds: ["caretaker-slime-d4", seasonOne.evolutionStages.at(-1)!.id] }
        : stage),
    })).toThrow(/cycle/i);
  });

  it("derives stable legacy aliases when canonical stages are reordered", () => {
    const season = loadSeason({
      ...seasonOne,
      evolutionStages: [...seasonOne.evolutionStages].reverse(),
    });

    expect(season.classStages.find((stage) => stage.id === "squire-d4")?.heroId).toBe("squire");
    expect(season.classStages.find((stage) => stage.id === "guardian-d6")?.nextStageIds).toEqual([
      "paladin-d8",
      "bastion-d8",
    ]);
  });

  it("rejects collisions in generated compatibility aliases", () => {
    expect(() => loadSeason({
      ...seasonOne,
      guardians: [
        ...seasonOne.guardians,
        { ...seasonOne.guardians[0], id: "squire", name: "Guardião Conflitante" },
      ],
    })).toThrow(/duplicate compatibility guardian id/i);
  });

  it("rejects phases outside exact campaign order", () => {
    expect(() => loadSeason({ ...seasonOne, phases: [...seasonOne.phases].reverse() }))
      .toThrow(/phase order/i);
  });

  it("rejects malformed phase room escalation", () => {
    expect(() => loadSeason({
      ...seasonOne,
      phases: seasonOne.phases.map((phase, index) => index === 2 ? { ...phase, roomCount: 9 } : phase),
    })).toThrow(/room count/i);
  });

  it("rejects malformed phase difficulty escalation", () => {
    expect(() => loadSeason({
      ...seasonOne,
      phases: seasonOne.phases.map((phase, index) => index === 2 ? { ...phase, difficulty: 7 } : phase),
    })).toThrow(/difficulty/i);
  });

  it("rejects reused phase bosses", () => {
    expect(() => loadSeason({
      ...seasonOne,
      phases: seasonOne.phases.map((phase, index) => index === 1
        ? { ...phase, bossInvaderId: seasonOne.phases[0].bossInvaderId }
        : phase),
    })).toThrow(/unique boss/i);
  });

  it("rejects a phase target that is not a boss", () => {
    expect(() => loadSeason({
      ...seasonOne,
      phases: seasonOne.phases.map((phase, index) => index === 0
        ? { ...phase, bossInvaderId: "torch-bearer" }
        : phase),
    })).toThrow(/boss rank/i);
  });
});
