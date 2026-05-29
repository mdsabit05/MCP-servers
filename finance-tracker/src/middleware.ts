import { eq, and, gt } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { auth } from './auth.js'
import { db } from './db.js'
import { session, user } from './schema.js'
import type { HonoEnv } from './types.js'

export const sessionMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  // Support Bearer token for MCP clients (Claude Desktop etc.)
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const now = new Date()
    const row = await db
      .select({ userId: session.userId, expiresAt: session.expiresAt })
      .from(session)
      .where(and(eq(session.token, token), gt(session.expiresAt, now)))
      .get()
    if (!row) return c.json({ error: 'Unauthorized' }, 401)
    c.set('userId', row.userId)
    await next()
    return
  }

  // Cookie-based session (browser)
  const s = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!s) return c.json({ error: 'Unauthorized' }, 401)
  c.set('userId', s.user.id)
  await next()
}
