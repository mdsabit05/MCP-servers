import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins/bearer';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/index.js';
import * as schema from './db/schema.js';

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me',
  baseURL: process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 54786}`,
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
  },
  plugins: [
    bearer(), // enables Authorization: Bearer <token> header auth
  ],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
