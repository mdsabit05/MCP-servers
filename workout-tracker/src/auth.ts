import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/client.ts";
import * as schema from "./db/schema.ts";

const BASE_URL = process.env.BASE_URL ?? "https://mcpproject4-be-tn.groo.bot";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
  baseURL: BASE_URL,
  basePath: "/api/auth",
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  trustedOrigins: [
    BASE_URL,
    "https://mcpproject4-fe-tn.groo.bot",
    ...(process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : []),
  ],
});

export type Session = typeof auth.$Infer.Session;
