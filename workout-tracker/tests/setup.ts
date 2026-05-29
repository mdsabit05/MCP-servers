import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/db/schema.ts";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  // run inline migration from schema
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "email" text NOT NULL UNIQUE,
      "emailVerified" integer NOT NULL DEFAULT 0,
      "image" text,
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "session" (
      "id" text PRIMARY KEY,
      "expiresAt" integer NOT NULL,
      "token" text NOT NULL UNIQUE,
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL,
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL REFERENCES "user"("id")
    );
    CREATE TABLE IF NOT EXISTS "account" (
      "id" text PRIMARY KEY,
      "accountId" text NOT NULL,
      "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES "user"("id"),
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" integer,
      "refreshTokenExpiresAt" integer,
      "scope" text,
      "password" text,
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "verification" (
      "id" text PRIMARY KEY,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expiresAt" integer NOT NULL,
      "createdAt" integer,
      "updatedAt" integer
    );
    CREATE TABLE IF NOT EXISTS "exercises" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL UNIQUE,
      "muscle_group" text NOT NULL,
      "equipment" text,
      "created_at" integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS "workouts" (
      "id" text PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "user"("id"),
      "name" text,
      "started_at" integer NOT NULL DEFAULT (unixepoch()),
      "completed_at" integer,
      "notes" text
    );
    CREATE TABLE IF NOT EXISTS "workout_exercises" (
      "id" text PRIMARY KEY,
      "workout_id" text NOT NULL REFERENCES "workouts"("id"),
      "exercise_id" text NOT NULL REFERENCES "exercises"("id"),
      "order" integer NOT NULL DEFAULT 0,
      "notes" text
    );
    CREATE TABLE IF NOT EXISTS "sets" (
      "id" text PRIMARY KEY,
      "workout_exercise_id" text NOT NULL REFERENCES "workout_exercises"("id"),
      "set_number" integer NOT NULL,
      "reps" integer,
      "weight_kg" real,
      "duration_seconds" integer,
      "rpe" real,
      "notes" text,
      "logged_at" integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS "routines" (
      "id" text PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "user"("id"),
      "name" text NOT NULL,
      "description" text,
      "created_at" integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS "routine_exercises" (
      "id" text PRIMARY KEY,
      "routine_id" text NOT NULL REFERENCES "routines"("id"),
      "exercise_id" text NOT NULL REFERENCES "exercises"("id"),
      "order" integer NOT NULL DEFAULT 0,
      "target_sets" integer NOT NULL DEFAULT 3,
      "target_reps" integer,
      "target_weight_kg" real
    );
  `);
  return { db, sqlite };
}

export const TEST_USER_ID = "test-user-1";
export const TEST_USER_2_ID = "test-user-2";

export function seedTestUser(sqlite: Database.Database) {
  const now = Math.floor(Date.now() / 1000);
  sqlite.exec(`
    INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES ('${TEST_USER_ID}', 'Alice', 'alice@example.com', 1, ${now}, ${now});
    INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES ('${TEST_USER_2_ID}', 'Bob', 'bob@example.com', 1, ${now}, ${now});
    INSERT OR IGNORE INTO "exercises" (id, name, muscle_group, equipment)
    VALUES ('ex-squat', 'Barbell Squat', 'legs', 'barbell'),
           ('ex-bench', 'Bench Press', 'chest', 'barbell'),
           ('ex-deadlift', 'Deadlift', 'back', 'barbell'),
           ('ex-ohp', 'Overhead Press', 'shoulders', 'barbell'),
           ('ex-row', 'Barbell Row', 'back', 'barbell');
  `);
}
