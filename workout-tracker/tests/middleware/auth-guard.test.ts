import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authGuard } from "../../src/middleware/auth-guard.ts";

describe("authGuard", () => {
  it("returns 401 when no Authorization header", async () => {
    const app = new Hono();
    app.use("/protected", authGuard);
    app.get("/protected", (c) => c.json({ ok: true }));

    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 for malformed Bearer token", async () => {
    const app = new Hono();
    app.use("/protected", authGuard);
    app.get("/protected", (c) => c.json({ ok: true }));

    const res = await app.request("/protected", {
      headers: { Authorization: "NotBearer abc" },
    });
    expect(res.status).toBe(401);
  });
});
