import { seasonSchema, type Season } from "./schema";

function assertUnique(label: string, ids: readonly string[]) {
  if (new Set(ids).size !== ids.length) throw new Error(`duplicate ${label} id`);
}

export function loadSeason(input: unknown): Readonly<Season> {
  const season = seasonSchema.parse(input);

  assertUnique("guardian", season.guardians.map(({ id }) => id));
  assertUnique("evolution stage", season.evolutionStages.map(({ id }) => id));
  assertUnique("die", season.dice.map(({ id }) => id));
  assertUnique("invader", season.invaders.map(({ id }) => id));
  assertUnique("event", season.events.map(({ id }) => id));
  assertUnique("phase", season.phases.map(({ id }) => id));

  const dieIds = new Set(season.dice.map(({ id }) => id));
  const guardianIds = new Set(season.guardians.map(({ id }) => id));
  const invaderIds = new Set(season.invaders.map(({ id }) => id));
  const stagesById = new Map(season.evolutionStages.map((stage) => [stage.id, stage]));

  for (const guardian of season.guardians) {
    for (const dieId of guardian.startingDiceIds) {
      if (!dieIds.has(dieId)) throw new Error(`guardian references unknown die: ${dieId}`);
    }
    if (!stagesById.has(guardian.rootEvolutionStageId)) {
      throw new Error(`guardian references unknown root evolution stage: ${guardian.rootEvolutionStageId}`);
    }
  }
  for (const phase of season.phases) {
    if (!invaderIds.has(phase.bossInvaderId)) {
      throw new Error(`phase references unknown boss invader: ${phase.bossInvaderId}`);
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const nextSides = new Map([[4, 6], [6, 8], [8, 10], [10, 12], [12, 20]]);
  const visit = (stageId: string, guardianId: string, root = false) => {
    if (visiting.has(stageId)) throw new Error(`cycle in evolution tree at ${stageId}`);
    const stage = stagesById.get(stageId);
    if (!stage) throw new Error(`unknown evolution stage ${stageId}`);
    if (!guardianIds.has(stage.guardianId)) throw new Error(`evolution stage references unknown guardian: ${stage.guardianId}`);
    if (stage.guardianId !== guardianId) throw new Error(`evolution stage ${stageId} belongs to another guardian`);
    if (visited.has(stageId)) return;
    if (root && stage.sides !== 4) throw new Error(`root evolution stage ${stageId} must use a D4`);

    visiting.add(stageId);
    stage.nextStageIds.forEach((childId) => visit(childId, guardianId));
    visiting.delete(stageId);

    const expectedSides = nextSides.get(stage.sides);
    if (expectedSides === undefined && stage.nextStageIds.length !== 0) {
      throw new Error(`terminal D20 evolution stage ${stageId} cannot have children`);
    }
    if (expectedSides !== undefined && stage.nextStageIds.length !== 2) {
      throw new Error(`evolution stage ${stageId} must offer two branches`);
    }
    for (const childId of stage.nextStageIds) {
      if (stagesById.get(childId)?.sides !== expectedSides) throw new Error(`invalid evolution die size after ${stageId}`);
    }
    visited.add(stageId);
  };

  for (const guardian of season.guardians) visit(guardian.rootEvolutionStageId, guardian.id, true);
  if (visited.size !== season.evolutionStages.length) throw new Error("orphan evolution stage");

  return Object.freeze(season);
}
