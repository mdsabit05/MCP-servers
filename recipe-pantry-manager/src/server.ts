import express, { type Request, type Response } from 'express'
import { toNodeHandler } from 'better-auth/node'
import { oAuthDiscoveryMetadata, oAuthProtectedResourceMetadata } from 'better-auth/plugins'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { auth, validateBearerToken } from './auth.js'
import { createMcpServer } from './tools/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Convert a Fetch API Response to an Express response.
 */
async function sendFetchResponse(fetchRes: globalThis.Response, res: Response): Promise<void> {
  res.status(fetchRes.status)
  fetchRes.headers.forEach((value, key) => res.setHeader(key, value))
  const body = await fetchRes.text()
  res.send(body)
}

export function createApp() {
  const app = express()

  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // Serve public HTML pages at clean URLs (/login, /consent, /register)
  const pub = path.join(__dirname, '../public')
  app.use(express.static(pub))
  app.get('/login',    (_req, res) => res.sendFile(path.join(pub, 'login.html')))
  app.get('/consent',  (_req, res) => res.sendFile(path.join(pub, 'consent.html')))
  app.get('/register', (_req, res) => res.sendFile(path.join(pub, 'register.html')))

  // ─── OAuth Discovery (served at root, required by MCP spec) ──────────────

  // RFC 8414 — Authorization Server Metadata
  // better-auth's mcp plugin registers this, but we serve it at root via helper
  app.get('/.well-known/oauth-authorization-server', async (req, res) => {
    const base = process.env.BASE_URL || 'http://localhost:3000'
    const fetchReq = new Request(`${base}/.well-known/oauth-authorization-server`)
    const fetchRes = await oAuthDiscoveryMetadata(auth)(fetchReq)
    await sendFetchResponse(fetchRes, res)
  })

  // RFC 9728 — Protected Resource Metadata
  app.get('/.well-known/oauth-protected-resource', async (req, res) => {
    const base = process.env.BASE_URL || 'http://localhost:3000'
    const fetchReq = new Request(`${base}/.well-known/oauth-protected-resource`)
    const fetchRes = await oAuthProtectedResourceMetadata(auth)(fetchReq)
    await sendFetchResponse(fetchRes, res)
  })

  // ─── better-auth: all /api/auth/* routes ─────────────────────────────────
  // This handles: sign-in, sign-up, sessions, OAuth flow, token exchange, etc.
  app.all('/api/auth/*', toNodeHandler(auth))

  // ─── MCP Endpoint (OAuth-protected) ──────────────────────────────────────
  app.all('/mcp', async (req: Request, res: Response) => {
    const base = process.env.BASE_URL || 'http://localhost:3000'

    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="${base}", resource_metadata="${base}/.well-known/oauth-protected-resource"`
      )
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Missing Bearer token. Authenticate via OAuth first.',
      })
      return
    }

    const userId = await validateBearerToken(authHeader)

    if (!userId) {
      res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="${base}", error="invalid_token"`
      )
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'The access token is invalid or has expired.',
      })
      return
    }

    // Create a fresh, user-scoped MCP server per request (stateless OAuth model)
    const server = createMcpServer(userId)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — token is re-validated each request
    })

    try {
      await server.connect(transport)
      await transport.handleRequest(req as any, res as any, req.body)
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: 'internal_error', message: String(err) })
      }
    } finally {
      res.on('finish', () => { server.close().catch(() => {}) })
    }
  })

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Recipe & Pantry Manager MCP Server' })
  })

  return app
}
