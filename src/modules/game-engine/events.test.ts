import { describe, expect, it } from "vitest";
import { seasonOne } from "@/modules/content/season-1";
import { createEventOffer, resolveEventChoice } from "./events";
import { chooseReward, createRewardOffer } from "./rewards";

describe("closed offers", () => {
  it("only accepts a reward id from the current offer", () => {
    const offer = createRewardOffer("reward-seed", 0, seasonOne.dice.map((die) => die.id));
    expect(offer.options).toHaveLength(3);
    expect(chooseReward(offer, offer.options[0]!.offerId).dieId).toBe(offer.options[0]!.dieId);
    expect(() => chooseReward(offer, "reward-forged")).toThrow(/offered/i);
  });

  it("only accepts an event option id from the current offer", () => {
    const event = seasonOne.events.find((candidate) => candidate.id === "goblin-insurance")!;
    const offer = createEventOffer(event, "event-seed", 0);

    expect(() => resolveEventChoice({ offer, offerId: "option-forged", seed: "event-seed", rngCursor: offer.rngCursor, gold: 10 })).toThrow(/offered/i);
  });
});

describe("Goblin Vendedor de Seguro", () => {
  it("charges run gold when insurance is purchased", () => {
    const event = seasonOne.events.find((candidate) => candidate.id === "goblin-insurance")!;
    const offer = createEventOffer(event, "insurance-seed", 0);
    const buy = offer.options.find((option) => option.optionId === "buy")!;
    const result = resolveEventChoice({ offer, offerId: buy.offerId, seed: "insurance-seed", rngCursor: offer.rngCursor, gold: 10 });

    expect(result.gold).toBe(5);
    expect(result.hasInsurance).toBe(true);
  });

  it("resolves theft with server RNG and emits a safe audit record", () => {
    const event = seasonOne.events.find((candidate) => candidate.id === "goblin-insurance")!;
    const offer = createEventOffer(event, "theft-seed", 0);
    const steal = offer.options.find((option) => option.optionId === "steal")!;
    const first = resolveEventChoice({ offer, offerId: steal.offerId, seed: "theft-seed", rngCursor: offer.rngCursor, gold: 0 });
    const second = resolveEventChoice({ offer, offerId: steal.offerId, seed: "theft-seed", rngCursor: offer.rngCursor, gold: 0 });

    expect(first).toEqual(second);
    expect(first.rngCursor).toBeGreaterThan(offer.rngCursor);
    expect(first.audit).toMatchObject({ eventId: "goblin-insurance", optionId: "steal" });
    expect(JSON.stringify(first.audit)).not.toMatch(/probability|threshold|roll/i);
  });
});
