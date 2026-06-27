import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  start: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/modules/run/run-service-instance", () => ({
  getRunService: () => ({ start: mocks.start }),
}));

function request(body: unknown) {
  return new Request("http://localhost/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("start run API", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.start.mockReset();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.start.mockResolvedValue({ id: "run-1", version: 0, state: {} });
  });

  it("starts runs with a canonical guardian id", async () => {
    const { POST } = await import("@/app/api/runs/route");

    const response = await POST(request({ guardianId: "caretaker-slime" }));

    expect(response.status).toBe(201);
    expect(mocks.start).toHaveBeenCalledWith("user-1", "caretaker-slime");
  });

  it("rejects legacy hero ids", async () => {
    const { POST } = await import("@/app/api/runs/route");

    const response = await POST(request({ heroId: "squire" }));

    expect(response.status).toBe(400);
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
