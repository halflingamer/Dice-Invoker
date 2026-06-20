import { describe, expect, it } from "vitest";
import { resolveCombatExchange, rollClassCombatDice, resolveTurn } from "./combat";
import { loadSeason } from "@/modules/content/content-loader";
import { seasonOne } from "@/modules/content/season-1";

const season = loadSeason(seasonOne);

describe("resolveCombatExchange", () => {
  it("applies the enemy counter attack after the hero attack", () => {
    expect(
      resolveCombatExchange({
        heroHp: 24,
        enemyHp: 18,
        heroDamage: 5,
        heroDefense: 2,
        enemyAttack: 6,
      }),
    ).toEqual({
      heroHp: 20,
      enemyHp: 13,
      damageDealt: 5,
      damageTaken: 4,
      victory: false,
      defeat: false,
    });
  });

  it("does not counter attack when the hero defeats the enemy", () => {
    expect(
      resolveCombatExchange({
        heroHp: 24,
        enemyHp: 3,
        heroDamage: 5,
        heroDefense: 2,
        enemyAttack: 6,
      }),
    ).toEqual({
      heroHp: 24,
      enemyHp: 0,
      damageDealt: 5,
      damageTaken: 0,
      victory: true,
      defeat: false,
    });
  });

  it.each(["heroHp", "enemyHp", "heroDamage", "heroDefense", "enemyAttack"] as const)(
    "rejects an invalid %s",
    (field) => {
      expect(() =>
        resolveCombatExchange({
          heroHp: 24,
          enemyHp: 18,
          heroDamage: 5,
          heroDefense: 2,
          enemyAttack: 6,
          [field]: -1,
        }),
      ).toThrow(`${field} must be a non-negative safe integer`);
    },
  );
});

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

describe("rollClassCombatDice", () => {
  it("rolls one damage die and one defense die from the current class stage", () => {
    const stage = season.classStages.find((candidate) => candidate.id === "squire-d4")!;
    const results = [1, 4];

    const rolled = rollClassCombatDice(stage, () => results.shift()!);

    expect(rolled.damage).toMatchObject({ kind: "damage", sides: 4, faceIndex: 1 });
    expect(rolled.damage.value).toBe(stage.faces[0]!.damage);
    expect(rolled.defense).toMatchObject({ kind: "defense", sides: 4, faceIndex: 4 });
    expect(rolled.defense.value).toBe(stage.faces[3]!.block);
  });
});
