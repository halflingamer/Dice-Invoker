import { seasonSchema, type Season } from "./schema";

function assertUnique(label: string, ids: string[]) {
  if (new Set(ids).size !== ids.length) {
    throw new Error(`duplicate ${label} id`);
  }
}

export function loadSeason(input: unknown): Readonly<Season> {
  const season = seasonSchema.parse(input);

  assertUnique("hero", season.heroes.map((item) => item.id));
  assertUnique("die", season.dice.map((item) => item.id));
  assertUnique("enemy", season.enemies.map((item) => item.id));
  assertUnique("event", season.events.map((item) => item.id));

  const dieIds = new Set(season.dice.map((die) => die.id));
  for (const hero of season.heroes) {
    for (const dieId of hero.startingDiceIds) {
      if (!dieIds.has(dieId)) throw new Error(`hero ${hero.id} references unknown die ${dieId}`);
    }
  }

  return Object.freeze(season);
}
