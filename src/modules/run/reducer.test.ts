import { describe, expect, it } from "vitest";
import { runCommandSchema } from "./command-schema";
import { createRun } from "./create-run";
import { applyCommand } from "./reducer";

describe("run reducer", () => {
  it("rejects reroll before roll and spends essence exactly once", () => {
    const run = createRun({ seed: "server-seed", heroId: "squire" });

    expect(() =>
      applyCommand(run, { type: "REROLL", sequence: 1, dieIds: ["rusty-sword"] }),
    ).toThrow(/phase/i);

    const rolled = applyCommand(run, { type: "ROLL_DICE", sequence: 1 });
    const rerolled = applyCommand(rolled, {
      type: "REROLL",
      sequence: 2,
      dieIds: ["rusty-sword"],
    });

    expect(rerolled.essence).toBe(rolled.essence - 1);
    expect(rerolled.sequence).toBe(2);
  });

  it("rejects replayed sequence numbers", () => {
    const run = createRun({ seed: "server-seed", heroId: "squire" });
    const rolled = applyCommand(run, { type: "ROLL_DICE", sequence: 1 });

    expect(() => applyCommand(rolled, { type: "ROLL_DICE", sequence: 1 })).toThrow(
      /sequence/i,
    );
  });

  it("rejects dice that are not equipped", () => {
    const run = createRun({ seed: "server-seed", heroId: "squire" });
    const rolled = applyCommand(run, { type: "ROLL_DICE", sequence: 1 });

    expect(() =>
      applyCommand(rolled, { type: "REROLL", sequence: 2, dieIds: ["star-arrow"] }),
    ).toThrow(/equipped/i);
  });

  it("rejects unknown payload fields", () => {
    expect(() =>
      runCommandSchema.parse({ type: "ROLL_DICE", sequence: 1, finalScore: 999_999 }),
    ).toThrow();
  });
});
