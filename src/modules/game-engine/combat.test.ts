import { describe, expect, it } from "vitest";
import { resolveTurn } from "./combat";

describe("resolveTurn", () => {
  it("applies block before incoming enemy damage", () => {
    const result = resolveTurn({
      heroHp: 20,
      heroMaxHp: 20,
      enemyHp: 12,
      block: 4,
      heroDamage: 6,
      enemyDamage: 7,
      healing: 0,
    });

    expect(result).toEqual({
      heroHp: 17,
      enemyHp: 6,
      blockRemaining: 0,
      outcome: "ongoing",
    });
  });

  it("does not allow hit points below zero or above maximum", () => {
    const defeated = resolveTurn({
      heroHp: 2,
      heroMaxHp: 20,
      enemyHp: 50,
      block: 0,
      heroDamage: 1,
      enemyDamage: 99,
      healing: 99,
    });
    expect(defeated.heroHp).toBe(0);

    const healed = resolveTurn({
      heroHp: 19,
      heroMaxHp: 20,
      enemyHp: 10,
      block: 20,
      heroDamage: 0,
      enemyDamage: 1,
      healing: 10,
    });
    expect(healed.heroHp).toBe(20);
  });

  it("returns victory without applying a defeated enemy action", () => {
    const result = resolveTurn({
      heroHp: 5,
      heroMaxHp: 20,
      enemyHp: 4,
      block: 0,
      heroDamage: 4,
      enemyDamage: 99,
      healing: 0,
    });

    expect(result).toEqual({
      heroHp: 5,
      enemyHp: 0,
      blockRemaining: 0,
      outcome: "victory",
    });
  });
});
