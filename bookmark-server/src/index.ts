import http from 'http';
import { auth } from './auth.js';
import { createMcpServer } from './server/mcp.js';
import { runWithUser } from './context.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const PORT = parseInt(process.env.PORT ?? '54786', 10);
const HOST = '0.0.0.0';

// ── helpers ────────────────────────────────────────────────────────────────

function nodeHeadersToWeb(headers: http.IncomingHttpHeaders): Headers {
  const webHeaders = new Headers();
  for (const [key, val] of Object.entries(headers)) {
    if (val === undefined) continue;
    webHeaders.set(key, Array.isArray(val) ? val.join(', ') : val);
  }
  return webHeaders;
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function sendWebResponse(webRes: Response, res: http.ServerResponse) {
  res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
  const body = await webRes.arrayBuffer();
  res.end(Buffer.from(body));
}

// ── request handler ────────────────────────────────────────────────────────

const httpServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const rawBody = await readBody(req);

    // ── Auth routes (/api/auth/*) ────────────────────────────────────────
    if (url.pathname.startsWith('/api/auth')) {
      const webHeaders = nodeHeadersToWeb(req.headers);
      const webReq = new Request(`http://localhost:${PORT}${req.url}`, {
        method: req.method,
        headers: webHeaders,
        body: rawBody.length > 0 ? rawBody.buffer as ArrayBuffer : undefined,
      });
      const webRes = await auth.handler(webReq);
      await sendWebResponse(webRes, res);
      return;
    }

    // ── MCP route (/mcp) ─────────────────────────────────────────────────
    if (url.pathname === '/mcp') {
      const webHeaders = nodeHeadersToWeb(req.headers);
      const session = await auth.api.getSession({ headers: webHeaders });

      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Unauthorized',
          hint: 'Visit /api/auth/sign-in/social?provider=github to sign in, then pass the session token as Authorization: Bearer <token>',
        }));
        return;
      }

      let body: unknown;
      try { body = JSON.parse(rawBody.toString('utf-8')); } catch { /* GET or empty body */ }

      // Per-request server + transport — safe for concurrent requests
      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

      await runWithUser(session.user.id, async () => {
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, body);
      });
      return;
    }

    // ── Health check ─────────────────────────────────────────────────────
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '0.1.0' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error('Request error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

// ── startup ────────────────────────────────────────────────────────────────

async function main() {
  // Run better-auth migrations (creates user, session, account, verification tables)
  try {
    // @ts-expect-error — $migrate is not in the public typings but exists at runtime
    await auth.api.$migrate?.();
  } catch {
    // Migrations may already be applied; not fatal
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`\nBookmark MCP Server running on http://${HOST}:${PORT}`);
    console.log(`  Auth:   http://${HOST}:${PORT}/api/auth/sign-in/social?provider=github`);
    console.log(`  MCP:    http://${HOST}:${PORT}/mcp`);
    console.log(`  Health: http://${HOST}:${PORT}/health\n`);
  });
}

main().catch(console.error);
