import { expect, it } from "vitest";
import { authPolicy } from "./auth-policy";

it("requires database sessions and only GitHub authentication", () => {
  expect(authPolicy.sessionStrategy).toBe("database");
  expect(authPolicy.providerIds).toEqual(["github"]);
});
