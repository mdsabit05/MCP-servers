import { serve } from '@hono/node-server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { mcpAuthHono } from 'better-auth/plugins/mcp/client/adapters'
import { auth } from './auth.js'
import { db, initSchema } from './db.js'
import { sessionMiddleware } from './middleware.js'
import { createMcpServer } from './server.js'
import type { HonoEnv } from './types.js'

const port = parseInt(process.env.PORT ?? '47392', 10)
const base = process.env.BASE_URL ?? `http://localhost:${port}`

const mcpAuth = mcpAuthHono({
  authURL: `${base}/api/auth`,
  resource: base,
})

const app = new Hono<HonoEnv>()

// CORS for all routes (required for MCP OAuth browser flows)
app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'] }))

// OAuth discovery endpoints (required for Claude connector auto-discovery)
mcpAuth.discoveryRoutes(app, base)

// RFC 8414 compliant path: /.well-known/oauth-authorization-server{/path} for auth server with path component
app.get('/.well-known/oauth-authorization-server/*', async (c) => {
  const res = await fetch(`${base}/api/auth/.well-known/oauth-authorization-server`)
  const data = await res.json()
  return c.json(data)
})

// Auth routes — better-auth handles GitHub, Google, and MCP OAuth flows
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// Sign-in page with GitHub OAuth button
app.get('/signin', (c) =>
  c.html(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Sign In</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0d1117}
.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:40px;text-align:center;max-width:360px;width:90%}
h1{color:#f0f6fc;margin:0 0 8px}p{color:#8b949e;margin:0 0 28px}
button{background:#238636;color:#fff;border:none;border-radius:6px;padding:12px 24px;font-size:16px;cursor:pointer;width:100%}
button:hover{background:#2ea043}</style></head>
<body><div class="card">
<h1>Finance Tracker</h1>
<p>Sign in to access your financial data</p>
<form id="f"><button type="submit">Sign in with GitHub</button></form>
<script>
document.getElementById('f').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const params=new URLSearchParams(window.location.search);
  // Use callbackURL from query if provided, else /auth/success
  // better-auth's oidc_login_prompt cookie handles MCP OAuth re-authorization automatically
  const cb=params.get('callbackURL')||'/auth/success';
  const r=await fetch('/api/auth/sign-in/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'github',callbackURL:cb})});
  const d=await r.json();
  if(d.url)window.location.href=d.url;
});
</script>
</div></body></html>`),
)

// After OAuth: show session info (for manual Claude Desktop config if needed)
app.get('/auth/success', async (c) => {
  const s = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!s) return c.redirect('/signin')
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Connected</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0d1117}
.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:40px;max-width:560px;width:90%;text-align:center}
h1{color:#f0f6fc;margin:0 0 8px}p{color:#8b949e;margin:0 0 16px}
.badge{background:#238636;color:#fff;border-radius:20px;padding:4px 14px;font-size:13px;display:inline-block;margin-bottom:24px}
</style></head>
<body><div class="card">
<div class="badge">Signed in</div>
<h1>${s.user.name}</h1>
<p>${s.user.email}</p>
<p style="font-size:13px">You can now connect Claude.ai or Claude Desktop to:<br>
<code style="color:#79c0ff">${base}/mcp</code></p>
<p style="font-size:13px;color:#8b949e">For Claude.ai: go to Settings → Integrations → Add → enter the URL above.<br>
It will guide you through OAuth automatically.</p>
</div></body></html>`)
})

// MCP route — protected by MCP OAuth Bearer token (for Claude connector / Claude Desktop via OAuth)
app.use('/mcp', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const hasCookie = c.req.header('Cookie')?.includes('better-auth')

  if (authHeader?.startsWith('Bearer ')) {
    // MCP OAuth token path — also sets WWW-Authenticate on failure
    return mcpAuth.middleware(c, async () => {
      const mcpSession = (c as any).get('mcpSession')
      c.set('userId', mcpSession?.userId ?? mcpSession?.user?.id ?? '')
      await next()
    })
  }

  if (hasCookie) {
    // Browser/cookie session fallback (manual testing via browser)
    return sessionMiddleware(c, next)
  }

  // No auth at all — return 401 with WWW-Authenticate so Claude can discover OAuth
  c.header('WWW-Authenticate', `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`)
  return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
})

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

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.log(`Finance MCP server running on http://0.0.0.0:${port}`)
  console.log(`Sign in at: ${base}/signin`)
  console.log(`MCP endpoint: ${base}/mcp`)
})
