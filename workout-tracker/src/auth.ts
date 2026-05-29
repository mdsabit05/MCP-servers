import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/client.ts";
import * as schema from "./db/schema.ts";

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
  baseURL: process.env.BASE_URL ?? "https://mcpproject4-be-tn.groo.bot",
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  trustedOrigins: [process.env.BASE_URL ?? "https://mcpproject4-be-tn.groo.bot"],
});

export type Session = typeof auth.$Infer.Session;
