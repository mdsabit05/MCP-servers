import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { mcp } from 'better-auth/plugins'
import { db } from './db.js'
import { user, session, account, verification, oauthApplication, oauthAccessToken, oauthConsent } from './schema.js'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: { user, session, account, verification, oauthApplication, oauthAccessToken, oauthConsent },
  }),
  baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  basePath: '/api/auth',
  trustedOrigins: [process.env.BASE_URL ?? 'http://localhost:3000'],
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production',
  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  plugins: [
    mcp({
      loginPage: '/signin',
    }),
  ],
})
