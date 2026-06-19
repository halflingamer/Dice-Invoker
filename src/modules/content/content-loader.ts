import { seasonSchema, type Season } from "./schema";

function assertUnique(label: string, ids: string[]) {
  if (new Set(ids).size !== ids.length) {
    throw new Error(`duplicate ${label} id`);
  }
}

export function loadSeason(input: unknown): Readonly<Season> {
  const season = seasonSchema.parse(input);

  assertUnique("hero", season.heroes.map((item) => item.id));
  assertUnique("class stage", season.classStages.map((item) => item.id));
  assertUnique("die", season.dice.map((item) => item.id));
  assertUnique("enemy", season.enemies.map((item) => item.id));
  assertUnique("event", season.events.map((item) => item.id));

  const dieIds = new Set(season.dice.map((die) => die.id));
  for (const hero of season.heroes) {
    for (const dieId of hero.startingDiceIds) {
      if (!dieIds.has(dieId)) throw new Error(`hero ${hero.id} references unknown die ${dieId}`);
    }
    if (hero.unlock.kind === "starter" && !hero.rootClassStageId) {
      throw new Error(`starter hero ${hero.id} requires a root class stage`);
    }
  }

  const stagesById = new Map(season.classStages.map((stage) => [stage.id, stage]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const expectedNextSides = new Map([[4, 6], [6, 8], [8, 10], [10, 12]]);

  const visitClassStage = (stageId: string, heroId: string, isRoot = false) => {
    if (visiting.has(stageId)) throw new Error(`cycle in class tree at ${stageId}`);
    const stage = stagesById.get(stageId);
    if (!stage) throw new Error(`unknown class stage ${stageId}`);
    if (stage.heroId !== heroId) throw new Error(`class stage ${stageId} belongs to another hero`);
    if (visited.has(stageId)) return;
    if (isRoot && stage.sides !== 4) throw new Error(`root class stage ${stageId} must use a D4`);

    visiting.add(stageId);
    stage.nextStageIds.forEach((nextId) => visitClassStage(nextId, heroId));
    visiting.delete(stageId);

    const nextSides = expectedNextSides.get(stage.sides);
    if (nextSides === undefined && stage.nextStageIds.length !== 0) {
      throw new Error(`terminal D12 class stage ${stageId} cannot have children`);
    }
    if (nextSides !== undefined && stage.nextStageIds.length !== 2) {
      throw new Error(`class stage ${stageId} must offer two promotions`);
    }
    for (const nextId of stage.nextStageIds) {
      const child = stagesById.get(nextId)!;
      if (child.sides !== nextSides) throw new Error(`invalid class die size after ${stageId}`);
    }
    visited.add(stageId);
  };

  for (const hero of season.heroes) {
    if (hero.rootClassStageId) visitClassStage(hero.rootClassStageId, hero.id, true);
  }
  if (visited.size !== season.classStages.length) throw new Error("orphan class stage");

  return Object.freeze(season);
}
