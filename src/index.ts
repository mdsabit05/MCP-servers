import { serve } from '@hono/node-server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import { Hono } from 'hono'
import { auth } from './auth.js'
import { db, initSchema } from './db.js'
import { sessionMiddleware } from './middleware.js'
import { createMcpServer } from './server.js'
import type { HonoEnv } from './types.js'

const app = new Hono<HonoEnv>()

// Auth routes — better-auth handles GitHub and Google OAuth flows
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// Simple success page users are redirected to after OAuth
app.get('/auth/success', (c) =>
  c.html('<html><body><h1>Signed in successfully.</h1><p>You can close this tab.</p></body></html>'),
)

// All /mcp requests require a valid session
app.use('/mcp', sessionMiddleware)

// MCP route: create a fresh server per request, registered for this user only
app.all('/mcp', async (c) => {
  const userId = c.get('userId')
  const server = createMcpServer(userId, db)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  await server.connect(transport)

  let parsedBody: unknown
  const contentType = c.req.header('content-type') ?? ''
  if (contentType.includes('application/json')) {
    parsedBody = await c.req.json().catch(() => undefined)
  }

  return transport.handleRequest(c.req.raw, { parsedBody })
})

// Initialize our custom tables then start the server
initSchema()

const port = parseInt(process.env.PORT ?? '3000', 10)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Finance MCP server running on http://localhost:${port}`)
  console.log(`Sign in at: http://localhost:${port}/api/auth/signin/github`)
  console.log(`         or http://localhost:${port}/api/auth/signin/google`)
})
