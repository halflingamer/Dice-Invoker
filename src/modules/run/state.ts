export type RunPhase = "ready-to-roll" | "rolled" | "room-choice" | "reward" | "complete";

export type DieRoll = Readonly<{
  dieId: string;
  sides: number;
  result: number;
  locked: boolean;
}>;

export type RunState = Readonly<{
  seed: string;
  sequence: number;
  rngCursor: number;
  phase: RunPhase;
  heroId: string;
  heroHp: number;
  heroMaxHp: number;
  enemyId: string;
  enemyHp: number;
  essence: number;
  maxEssence: number;
  equippedDieIds: readonly string[];
  rolls: readonly DieRoll[];
}>;
