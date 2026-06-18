import { prisma } from "@/modules/db/prisma";
import { createRunService, type RunService } from "./run-service";

let instance: RunService | undefined;

export function getRunService(): RunService {
  if (instance) return instance;
  const encodedSecret = process.env.RUN_SEED_SECRET;
  if (!encodedSecret) throw new Error("RUN_SEED_SECRET is required");
  const seedSecret = Buffer.from(encodedSecret, "base64url");
  if (seedSecret.length !== 32) throw new Error("RUN_SEED_SECRET must encode exactly 32 bytes");
  instance = createRunService({ prisma, seedSecret });
  return instance;
}
