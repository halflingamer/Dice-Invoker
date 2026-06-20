import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { createSeedCipher } from "@/modules/security/seed-cipher";
import type { RunCommand } from "./command-schema";
import { createRun } from "./create-run";
import { applyCommand } from "./reducer";
import type { RunState } from "./state";

type PersistedRunState = Omit<RunState, "seed">;
type PublicRunState = PersistedRunState;
type MutablePartialRunState = { -readonly [Key in keyof RunState]?: RunState[Key] };

type RunResponse = Readonly<{
  id: string;
  version: number;
  state: PublicRunState;
}>;

type Dependencies = Readonly<{
  prisma: PrismaClient;
  seedSecret: Buffer;
}>;

function withoutSeed(state: RunState): PersistedRunState {
  const persisted: MutablePartialRunState = { ...state };
  delete persisted.seed;
  return persisted as PersistedRunState;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parsePersistedState(value: Prisma.JsonValue): PersistedRunState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored run state is invalid");
  }
  return value as unknown as PersistedRunState;
}

export function createRunService({ prisma, seedSecret }: Dependencies) {
  const seedCipher = createSeedCipher(seedSecret);

  async function findIdempotent(runId: string, idempotencyKey: string) {
    const existing = await prisma.runCommand.findUnique({
      where: { runId_idempotencyKey: { runId, idempotencyKey } },
    });
    return existing?.responseJson as unknown as RunResponse | undefined;
  }

  return {
    async start(ownerId: string, heroId: string): Promise<RunResponse> {
      const seed = randomBytes(32).toString("base64url");
      const state = createRun({ seed, heroId });
      const persisted = withoutSeed(state);
      const run = await prisma.run.create({
        data: {
          ownerId,
          engineVersion: "1.0.0",
          contentVersion: "1.0.0",
          sequence: state.sequence,
          seedCiphertext: seedCipher.encrypt(seed),
          stateJson: toJson(persisted),
        },
      });
      return { id: run.id, version: run.version, state: persisted };
    },

    async execute(
      ownerId: string,
      runId: string,
      idempotencyKey: string,
      command: RunCommand,
    ): Promise<RunResponse> {
      const prior = await findIdempotent(runId, idempotencyKey);
      if (prior) return prior;

      const run = await prisma.run.findFirst({ where: { id: runId, ownerId } });
      if (!run) throw new Error("run not found");

      const committedWhileLoading = await findIdempotent(runId, idempotencyKey);
      if (committedWhileLoading) return committedWhileLoading;

      const seed = seedCipher.decrypt(run.seedCiphertext);
      const currentState: RunState = { seed, ...parsePersistedState(run.stateJson) };
      const nextState = applyCommand(currentState, command);
      if (nextState === currentState) {
        return { id: run.id, version: run.version, state: withoutSeed(currentState) };
      }
      const persisted = withoutSeed(nextState);
      const response: RunResponse = { id: run.id, version: run.version + 1, state: persisted };

      try {
        await prisma.$transaction(async (transaction) => {
          const updated = await transaction.run.updateMany({
            where: { id: run.id, ownerId, version: run.version },
            data: {
              version: { increment: 1 },
              sequence: nextState.sequence,
              stateJson: toJson(persisted),
            },
          });
          if (updated.count !== 1) throw new Error("run version conflict");

          await transaction.runCommand.create({
            data: {
              runId,
              sequence: nextState.sequence,
              idempotencyKey,
              type: command.type,
              payloadJson: toJson(command),
              responseJson: toJson(response),
            },
          });
        });
        return response;
      } catch (error) {
        const concurrentResult = await findIdempotent(runId, idempotencyKey);
        if (concurrentResult) return concurrentResult;
        throw error;
      }
    },
  };
}

export type RunService = ReturnType<typeof createRunService>;
