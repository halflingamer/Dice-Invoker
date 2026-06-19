import type { ClassStage, Season } from "@/modules/content/schema";

export type HeroProgression = Readonly<{
  currentStageId: string;
  xp: number;
}>;

function stageById(stages: readonly ClassStage[], stageId: string): ClassStage {
  const stage = stages.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`unknown class stage ${stageId}`);
  return stage;
}

export function createHeroProgression(heroId: string, season: Readonly<Season>): HeroProgression {
  const hero = season.heroes.find((candidate) => candidate.id === heroId);
  if (!hero) throw new Error(`unknown hero ${heroId}`);
  if (!hero.rootClassStageId) throw new Error(`hero ${heroId} has no class progression`);
  return { currentStageId: hero.rootClassStageId, xp: 0 };
}

export function awardExperience(state: HeroProgression, amount: number): HeroProgression {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("experience award must be a non-negative safe integer");
  }
  const xp = state.xp + amount;
  if (!Number.isSafeInteger(xp)) throw new Error("experience total exceeds safe range");
  return { ...state, xp };
}

export function getPromotionChoices(
  state: HeroProgression,
  stages: readonly ClassStage[],
  context: Readonly<{ roomResolved: boolean }>,
): readonly ClassStage[] {
  if (!context.roomResolved) return [];
  const current = stageById(stages, state.currentStageId);
  if (current.nextStageIds.length === 0 || state.xp < current.xpThreshold) return [];
  return current.nextStageIds.map((stageId) => stageById(stages, stageId));
}

export function applyPromotion(
  state: HeroProgression,
  choiceId: string,
  stages: readonly ClassStage[],
): HeroProgression {
  const choices = getPromotionChoices(state, stages, { roomResolved: true });
  if (!choices.some((stage) => stage.id === choiceId)) {
    throw new Error("invalid promotion choice");
  }
  return { ...state, currentStageId: choiceId };
}
