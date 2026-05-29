import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db.js'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  basePath: '/api/auth',
  trustedOrigins: [process.env.BASE_URL ?? 'http://localhost:3000'],
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production',
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
})
