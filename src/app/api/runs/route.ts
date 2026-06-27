import { z } from "zod";
import { auth } from "@/auth";
import { getRunService } from "@/modules/run/run-service-instance";
import { parseJsonBody, RequestValidationError } from "@/modules/security/request";
import { createMemoryRateLimiter } from "@/modules/security/rate-limit";

const startRunSchema = z.object({ guardianId: z.string().regex(/^[a-z0-9-]+$/) }).strict();
const limiter = createMemoryRateLimiter();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "authentication_required" }, { status: 401 });
  if (!limiter.consume(`start-run:${session.user.id}`, 5, 60_000)) {
    return Response.json({ error: "rate_limit_exceeded" }, { status: 429 });
  }
  try {
    const { guardianId } = await parseJsonBody(request, startRunSchema);
    return Response.json(await getRunService().start(session.user.id, guardianId), { status: 201 });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "unable_to_start_run" }, { status: 400 });
  }
}
