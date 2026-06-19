import { describe, expect, it } from "vitest";
import { loadSeason } from "@/modules/content/content-loader";
import { seasonOne } from "@/modules/content/season-1";
import {
  applyPromotion,
  awardExperience,
  createHeroProgression,
  getPromotionChoices,
} from "./progression";

const season = loadSeason(seasonOne);

describe("hero class progression", () => {
  it("starts every run at the hero D4 root with zero experience", () => {
    const progressed = applyPromotion(
      awardExperience(createHeroProgression("squire", season), 500),
      "warrior-d6",
      season.classStages,
    );

    expect(progressed.currentStageId).toBe("warrior-d6");
    expect(createHeroProgression("squire", season)).toEqual({ currentStageId: "squire-d4", xp: 0 });
  });

  it("offers exactly two legal classes after reaching the threshold", () => {
    const below = awardExperience(createHeroProgression("squire", season), 59);
    const ready = awardExperience(below, 1);

    expect(getPromotionChoices(below, season.classStages, { roomResolved: true })).toEqual([]);
    expect(getPromotionChoices(ready, season.classStages, { roomResolved: true }).map((stage) => stage.id)).toEqual([
      "warrior-d6",
      "guardian-d6",
    ]);
  });

  it("waits until combat or the current room is resolved", () => {
    const ready = awardExperience(createHeroProgression("squire", season), 100);

    expect(getPromotionChoices(ready, season.classStages, { roomResolved: false })).toEqual([]);
    expect(getPromotionChoices(ready, season.classStages, { roomResolved: true })).toHaveLength(2);
  });

  it("accepts only an offered class and preserves cumulative experience", () => {
    const ready = awardExperience(createHeroProgression("squire", season), 200);

    expect(() => applyPromotion(ready, "duelist-d8", season.classStages)).toThrow(/promotion choice/i);
    expect(applyPromotion(ready, "guardian-d6", season.classStages)).toEqual({
      currentStageId: "guardian-d6",
      xp: 200,
    });
  });

  it("keeps D12 terminal even with excess experience", () => {
    const terminal = { currentStageId: "storm-of-steel-d12", xp: 10_000 };

    expect(getPromotionChoices(terminal, season.classStages, { roomResolved: true })).toEqual([]);
  });

  it("rejects invalid experience awards", () => {
    const start = createHeroProgression("squire", season);
    expect(() => awardExperience(start, -1)).toThrow(/experience/i);
    expect(() => awardExperience(start, 1.5)).toThrow(/experience/i);
  });
});
