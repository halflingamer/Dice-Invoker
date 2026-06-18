import { auth } from "@/auth";
import { prisma } from "@/modules/db/prisma";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "authentication_required" }, { status: 401 });
  const { runId } = await context.params;
  const run = await prisma.run.findFirst({
    where: { id: runId, ownerId: session.user.id },
    select: { id: true, version: true, stateJson: true, status: true, verificationStatus: true },
  });
  if (!run) return Response.json({ error: "run_not_found" }, { status: 404 });
  return Response.json({ id: run.id, version: run.version, state: run.stateJson, status: run.status });
}
