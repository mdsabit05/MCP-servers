import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── better-auth required tables ─────────────────────────────────────────────
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

// ── Workout domain tables ────────────────────────────────────────────────────
export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  muscleGroup: text("muscle_group").notNull(),
  equipment: text("equipment"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const workouts = sqliteTable("workouts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  name: text("name"),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  notes: text("notes"),
});

export const workoutExercises = sqliteTable("workout_exercises", {
  id: text("id").primaryKey(),
  workoutId: text("workout_id").notNull().references(() => workouts.id),
  exerciseId: text("exercise_id").notNull().references(() => exercises.id),
  order: integer("order").notNull().default(0),
  notes: text("notes"),
});

export const sets = sqliteTable("sets", {
  id: text("id").primaryKey(),
  workoutExerciseId: text("workout_exercise_id").notNull().references(() => workoutExercises.id),
  setNumber: integer("set_number").notNull(),
  reps: integer("reps"),
  weightKg: real("weight_kg"),
  durationSeconds: integer("duration_seconds"),
  rpe: real("rpe"),
  notes: text("notes"),
  loggedAt: integer("logged_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const routines = sqliteTable("routines", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const routineExercises = sqliteTable("routine_exercises", {
  id: text("id").primaryKey(),
  routineId: text("routine_id").notNull().references(() => routines.id),
  exerciseId: text("exercise_id").notNull().references(() => exercises.id),
  order: integer("order").notNull().default(0),
  targetSets: integer("target_sets").notNull().default(3),
  targetReps: integer("target_reps"),
  targetWeightKg: real("target_weight_kg"),
});

export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type Set = typeof sets.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
