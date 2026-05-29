import type { MiddlewareHandler } from 'hono'
import { auth } from './auth.js'
import type { HonoEnv } from './types.js'

export const sessionMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('userId', session.user.id)
  await next()
}
