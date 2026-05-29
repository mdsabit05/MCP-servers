import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '../types.js'

// Mock the auth module before importing middleware
vi.mock('../auth.js', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

// Import after mock
const { auth } = await import('../auth.js')
const { sessionMiddleware } = await import('../middleware.js')

describe('sessionMiddleware', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const app = new Hono<HonoEnv>()
    app.use('/protected', sessionMiddleware)
    app.get('/protected', (c) => c.json({ ok: true }))

    const res = await app.request('/protected')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('sets userId and calls next when session is valid', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'user-123', name: 'Test', email: 'test@test.com' },
      session: { id: 'sess-abc' },
    } as any)

    const app = new Hono<HonoEnv>()
    app.use('/protected', sessionMiddleware)
    app.get('/protected', (c) => c.json({ userId: c.get('userId') }))

    const res = await app.request('/protected')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.userId).toBe('user-123')
  })
})
