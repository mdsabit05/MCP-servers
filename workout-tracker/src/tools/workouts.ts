import { eq, and, desc } from "drizzle-orm";
import { workouts } from "../db/schema.ts";
import type { db as DbType } from "../db/client.ts";
import { randomUUID } from "crypto";

type Db = typeof DbType;

export async function logWorkout(
  db: Db,
  userId: string,
  input: { name?: string; notes?: string }
) {
  const id = randomUUID();
  const [workout] = await db
    .insert(workouts)
    .values({ id, userId, name: input.name ?? null, notes: input.notes ?? null, startedAt: new Date() })
    .returning();
  return { workout };
}

export async function listWorkouts(
  db: Db,
  userId: string,
  input: { limit?: number; offset?: number }
) {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const rows = await db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.startedAt))
    .limit(limit)
    .offset(offset);
  return { workouts: rows };
}

export async function getWorkout(db: Db, userId: string, workoutId: string) {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));
  if (!workout) return null;
  return { workout, exercises: [] }; // exercises populated in sets tool
}

export async function completeWorkout(
  db: Db,
  userId: string,
  workoutId: string,
  input: { notes?: string }
) {
  const [updated] = await db
    .update(workouts)
    .set({ completedAt: new Date(), ...(input.notes ? { notes: input.notes } : {}) })
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .returning();
  if (!updated) return null;
  return { workout: updated };
}
