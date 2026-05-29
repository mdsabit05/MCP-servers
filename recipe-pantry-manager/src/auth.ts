import { betterAuth } from 'better-auth'
import { mcp } from 'better-auth/plugins'
import Database from 'better-sqlite3'

const dbPath = process.env.DATABASE_PATH || './data.db'

// better-auth v1.6 uses Kysely internally and auto-detects better-sqlite3 via
// the `aggregate` method check — pass the raw instance directly.
const sqlite = new Database(dbPath)

const providers: Record<string, { clientId: string; clientSecret: string }> = {}
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }
}

export const auth = betterAuth({
  database: sqlite,
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET || 'dev-secret-change-in-production',
  plugins: [
    mcp({
      loginPage: '/login',
      oidcConfig: {
        loginPage: '/login',
        consentPage: '/consent',
        allowDynamicClientRegistration: true,
        accessTokenExpiresIn: 3600,          // 1 hour
        refreshTokenExpiresIn: 60 * 60 * 24 * 30, // 30 days
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  ...(Object.keys(providers).length > 0 ? { socialProviders: providers } : {}),
})

export type Auth = typeof auth

/**
 * Validate a Bearer token from an Authorization header using better-auth's
 * getMcpSession. Returns the userId if the token is valid, null otherwise.
 */
export async function validateBearerToken(authorizationHeader: string): Promise<string | null> {
  try {
    const session = await auth.api.getMcpSession({
      headers: new Headers({ authorization: authorizationHeader }),
    })
    return session?.userId ?? null
  } catch {
    return null
  }
}
