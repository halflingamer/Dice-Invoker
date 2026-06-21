import { describe, expect, it } from "vitest";
import { createAttackRoll, resolveCombatExchange, rollClassCombatDice, resolveTurn } from "./combat";
import { loadSeason } from "@/modules/content/content-loader";
import { seasonOne } from "@/modules/content/season-1";

const season = loadSeason(seasonOne);

describe("resolveCombatExchange", () => {
  it("subtracts fixed defense from each attack", () => {
    expect(
      resolveCombatExchange({
        guardianHp: 24,
        invaderHp: 18,
        guardianAttack: 9,
        guardianDefense: 2,
        invaderAttack: 6,
        invaderDefense: 4,
      }),
    ).toEqual({
      guardianHp: 20,
      invaderHp: 13,
      damageDealt: 5,
      damageTaken: 4,
      victory: false,
      defeat: false,
    });
  });

  it("deals zero damage when defense meets or exceeds attack", () => {
    expect(
      resolveCombatExchange({
        guardianHp: 10, invaderHp: 10, guardianAttack: 4, guardianDefense: 8,
        invaderAttack: 6, invaderDefense: 4,
      }),
    ).toMatchObject({ guardianHp: 10, invaderHp: 10, damageDealt: 0, damageTaken: 0 });
  });

  it("clamps overkill damage and skips the counterattack", () => {
    expect(resolveCombatExchange({
      guardianHp: 3, invaderHp: 2, guardianAttack: 20, guardianDefense: 0,
      invaderAttack: 20, invaderDefense: 1,
    })).toEqual({ guardianHp: 3, invaderHp: 0, damageDealt: 19, damageTaken: 0, victory: true, defeat: false });
  });

  it("returns defeat when the invader's counterattack is lethal", () => {
    expect(resolveCombatExchange({
      guardianHp: 3, invaderHp: 10, guardianAttack: 2, guardianDefense: 1,
      invaderAttack: 6, invaderDefense: 1,
    })).toMatchObject({ guardianHp: 0, invaderHp: 9, victory: false, defeat: true });
  });

  it("respects guardian-first order when both attacks look lethal", () => {
    expect(resolveCombatExchange({
      guardianHp: 1, invaderHp: 1, guardianAttack: 1, guardianDefense: 0,
      invaderAttack: 1, invaderDefense: 0,
    })).toMatchObject({ guardianHp: 1, invaderHp: 0, damageTaken: 0, victory: true, defeat: false });
  });

  it.each(["guardianHp", "invaderHp", "guardianAttack", "guardianDefense", "invaderAttack", "invaderDefense"] as const)(
    "rejects an invalid %s",
    (field) => {
      expect(() =>
        resolveCombatExchange({
          guardianHp: 24, invaderHp: 18, guardianAttack: 5, guardianDefense: 2,
          invaderAttack: 6, invaderDefense: 2,
          [field]: -1,
        }),
      ).toThrow(`${field} must be a non-negative safe integer`);

      expect(() => resolveCombatExchange({
        guardianHp: 24, invaderHp: 18, guardianAttack: 5, guardianDefense: 2,
        invaderAttack: 6, invaderDefense: 2, [field]: Number.MAX_SAFE_INTEGER + 1,
      })).toThrow(`${field} must be a non-negative safe integer`);
    },
  );
});

describe("createAttackRoll", () => {
  it.each([4, 6, 8, 10, 12, 20] as const)("creates D%s rolls and marks only the maximum critical", (sides) => {
    expect(createAttackRoll(sides, 1)).toEqual({ sides, result: 1, critical: false });
    expect(createAttackRoll(sides, sides)).toEqual({ sides, result: sides, critical: true });
  });

  it.each([0, 1.5, 21, Number.MAX_SAFE_INTEGER + 1])("rejects invalid results", (result) => {
    expect(() => createAttackRoll(20, result)).toThrow("attack roll result must be an integer from 1 to 20");
  });
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
