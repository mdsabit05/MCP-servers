import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

// better-auth manages its own tables (user, session, account, verification)
// We use a separate DB instance so it doesn't conflict with Drizzle's singleton
const authSqlite = new Database(process.env.DATABASE_URL ?? "./zettelkasten.db");

export const auth = betterAuth({
  database: {
    type: "sqlite",
    db: authSqlite,
  },
  baseURL: process.env.BASE_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  trustedOrigins: [process.env.BASE_URL ?? "http://localhost:3000"],
});

export type Auth = typeof auth;
