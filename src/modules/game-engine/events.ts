import type { SeasonEvent } from "@/modules/content/schema";
import { createNamedRollStream } from "./rng";

export type EventOptionOffer = Readonly<{
  offerId: string;
  optionId: string;
  label: string;
}>;

export type EventOffer = Readonly<{
  eventId: string;
  options: readonly EventOptionOffer[];
  rngCursor: number;
}>;

export type EventAuditRecord = Readonly<{
  eventId: string;
  optionId: string;
  outcome: "purchased" | "ignored" | "success" | "failure" | "resolved";
}>;

export type EventChoiceResult = Readonly<{
  gold: number;
  hasInsurance: boolean;
  hpDelta: number;
  rngCursor: number;
  audit: EventAuditRecord;
}>;

type ResolveEventChoiceInput = Readonly<{
  offer: EventOffer;
  offerId: string;
  seed: string;
  rngCursor: number;
  gold: number;
}>;

const INSURANCE_COST = 5;
const THEFT_SUCCESS_CEILING = 40;

export function createEventOffer(event: SeasonEvent, seed: string, initialCursor: number): EventOffer {
  const stream = createNamedRollStream(seed, "event", initialCursor);
  const options = event.options.map((option, index): EventOptionOffer => ({
    offerId: `event-${index + 1}-${stream.roll(100)}`,
    optionId: option.id,
    label: option.label,
  }));
  return { eventId: event.id, options, rngCursor: stream.cursor() };
}

export function resolveEventChoice(input: ResolveEventChoiceInput): EventChoiceResult {
  if (!Number.isSafeInteger(input.gold) || input.gold < 0) throw new Error("gold must be a non-negative integer");
  const selected = input.offer.options.find((option) => option.offerId === input.offerId);
  if (!selected) throw new Error("event option was not offered");

  const unchanged = {
    gold: input.gold,
    hasInsurance: false,
    hpDelta: 0,
    rngCursor: input.rngCursor,
  };

  if (input.offer.eventId !== "goblin-insurance") {
    return { ...unchanged, audit: { eventId: input.offer.eventId, optionId: selected.optionId, outcome: "resolved" } };
  }

  if (selected.optionId === "buy") {
    if (input.gold < INSURANCE_COST) throw new Error("not enough gold to buy insurance");
    return {
      ...unchanged,
      gold: input.gold - INSURANCE_COST,
      hasInsurance: true,
      audit: { eventId: input.offer.eventId, optionId: selected.optionId, outcome: "purchased" },
    };
  }

  if (selected.optionId === "ignore") {
    return { ...unchanged, audit: { eventId: input.offer.eventId, optionId: selected.optionId, outcome: "ignored" } };
  }

  if (selected.optionId === "steal") {
    const stream = createNamedRollStream(input.seed, "event", input.rngCursor);
    const succeeded = stream.roll(100) <= THEFT_SUCCESS_CEILING;
    return {
      ...unchanged,
      hasInsurance: succeeded,
      hpDelta: succeeded ? 0 : -3,
      rngCursor: stream.cursor(),
      audit: { eventId: input.offer.eventId, optionId: selected.optionId, outcome: succeeded ? "success" : "failure" },
    };
  }

  throw new Error("event option is not supported");
}
