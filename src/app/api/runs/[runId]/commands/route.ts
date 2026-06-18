import { auth } from "@/auth";
import { createRunCommandHandler } from "@/modules/run/run-command-handler";
import { getRunService } from "@/modules/run/run-service-instance";
import { createMemoryRateLimiter } from "@/modules/security/rate-limit";

const limiter = createMemoryRateLimiter();

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const handler = createRunCommandHandler({
    authenticate: async () => {
      const session = await auth();
      return session?.user?.id ? { userId: session.user.id } : null;
    },
    execute: (...arguments_) => getRunService().execute(...arguments_),
    consumeRateLimit: (userId, targetRunId) =>
      limiter.consume(`account:${userId}`, 180, 60_000) &&
      limiter.consume(`run:${targetRunId}`, 60, 60_000),
  });
  return handler(request, runId);
}
