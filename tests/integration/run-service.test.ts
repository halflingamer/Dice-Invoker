import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/modules/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { createRunService } from "@/modules/run/run-service";

const service = createRunService({
  prisma,
  seedSecret: Buffer.alloc(32, 7),
});

describe("run service", () => {
  beforeEach(async () => {
    await prisma.runCommand.deleteMany();
    await prisma.run.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores one command for concurrent requests with the same idempotency key", async () => {
    const user = await prisma.user.create({ data: { email: "invoker@example.test" } });
    const run = await service.start(user.id, "caretaker-slime");
    await prisma.run.update({
      where: { id: run.id },
      data: {
        stateJson: JSON.parse(JSON.stringify({
          ...run.state,
          phase: "ready-to-roll",
          currentRoomId: run.state.map.layers[0]!.nodes[0]!.id,
          availableRoomIds: [],
        })) as Prisma.InputJsonValue,
      },
    });
    const command = { type: "ROLL_DICE" as const, sequence: 1 };

    const [first, second] = await Promise.all([
      service.execute(user.id, run.id, "11111111-1111-4111-8111-111111111111", command),
      service.execute(user.id, run.id, "11111111-1111-4111-8111-111111111111", command),
    ]);

    expect(first).toEqual(second);
    expect(await prisma.runCommand.count({ where: { runId: run.id } })).toBe(1);
    expect((await prisma.run.findUniqueOrThrow({ where: { id: run.id } })).sequence).toBe(1);
  });

  it("does not reveal a run owned by another user", async () => {
    const owner = await prisma.user.create({ data: { email: "owner@example.test" } });
    const attacker = await prisma.user.create({ data: { email: "attacker@example.test" } });
    const run = await service.start(owner.id, "caretaker-slime");

    await expect(
      service.execute(attacker.id, run.id, "22222222-2222-4222-8222-222222222222", {
        type: "ROLL_DICE",
        sequence: 1,
      }),
    ).rejects.toThrow(/not found/i);
  });
});
