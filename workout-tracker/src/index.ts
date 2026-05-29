import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { auth } from "./auth.ts";
import { authGuard } from "./middleware/auth-guard.ts";
import { createMcpServer } from "./mcp.ts";

const app = new Hono();

// CORS — allow MCP clients from any origin
app.use("*", cors({ origin: "*", allowHeaders: ["Authorization", "Content-Type"] }));

// ── OAuth discovery metadata ────────────────────────────────────────────────
// MCP clients look here to discover auth endpoints
app.get("/.well-known/oauth-authorization-server", (c) => {
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/api/auth/sign-in/github`,
    token_endpoint: `${base}/api/auth/session`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["profile", "email"],
  });
});

// ── better-auth routes (/api/auth/*) ────────────────────────────────────────
app.on(["GET", "POST"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

// ── MCP SSE endpoint ─────────────────────────────────────────────────────────
// Each connection is bound to the authenticated user. The transport writes SSE
// events; we pipe them through Hono's streamSSE helper.
const transports = new Map<string, SSEServerTransport>();

app.get("/mcp", authGuard, async (c) => {
  const userId = c.get("userId");
  const server = createMcpServer(userId);

  return streamSSE(c, async (stream) => {
    // SSEServerTransport expects a writable response and a POST path for messages
    const transport = new SSEServerTransport("/mcp/message", stream as unknown as any);
    const sessionId = crypto.randomUUID();
    transports.set(sessionId, transport);
    c.header("X-Session-Id", sessionId);

    await server.connect(transport);

    // Keep alive until client disconnects
    await new Promise<void>((resolve) => {
      c.req.raw.signal.addEventListener("abort", () => {
        transports.delete(sessionId);
        resolve();
      });
    });
  });
});

app.post("/mcp/message", authGuard, async (c) => {
  const sessionId = c.req.header("X-Session-Id") ?? c.req.query("sessionId");
  if (!sessionId) {
    return c.json({ error: "Missing X-Session-Id header" }, 400);
  }
  const transport = transports.get(sessionId);
  if (!transport) {
    return c.json({ error: "No active SSE session for this ID" }, 404);
  }
  await transport.handlePostMessage(c.req.raw);
  return c.json({ ok: true });
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok", tools: 14 }));

const port = parseInt(process.env.PORT ?? "47832", 10);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`Workout Tracker MCP server running on http://0.0.0.0:${port}`);
  console.log(`OAuth discovery: http://0.0.0.0:${port}/.well-known/oauth-authorization-server`);
  console.log(`MCP SSE endpoint: http://0.0.0.0:${port}/mcp  (requires Bearer token)`);
});
