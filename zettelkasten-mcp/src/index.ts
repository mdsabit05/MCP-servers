import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { getUserIdFromRequest } from "./lib/session.js";
import { registerAllTools } from "./tools/index.js";

const app = express();
app.use(express.json());

// Mount better-auth OAuth routes at /api/auth/*
app.all("/api/auth/*splat", toNodeHandler(auth));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// MCP endpoint (POST for RPC calls)
app.post("/mcp", async (req, res) => {
  const userId = await getUserIdFromRequest(req, auth);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized — sign in via /api/auth/signin/github" });
    return;
  }

  const server = new McpServer({
    name: "zettelkasten",
    version: "1.0.0",
  });

  registerAllTools(server, userId);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless per-request
  });

  res.on("close", () => transport.close());

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// MCP SSE endpoint (GET for streaming)
app.get("/mcp", async (req, res) => {
  const userId = await getUserIdFromRequest(req, auth);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const server = new McpServer({ name: "zettelkasten", version: "1.0.0" });
  registerAllTools(server, userId);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`Zettelkasten MCP server running on http://localhost:${PORT}`);
  console.log(`OAuth login: http://localhost:${PORT}/api/auth/signin/github`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
