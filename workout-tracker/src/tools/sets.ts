import { eq, and } from "drizzle-orm";
import { workouts, workoutExercises, sets } from "../db/schema.ts";
import type { db as DbType } from "../db/client.ts";
import { randomUUID } from "crypto";

type Db = typeof DbType;

export async function addExerciseToWorkout(
  db: Db,
  userId: string,
  workoutId: string,
  input: { exerciseId: string; notes?: string; order?: number }
) {
  // Verify workout ownership
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));
  if (!workout) return null;

  const [workoutExercise] = await db
    .insert(workoutExercises)
    .values({
      id: randomUUID(),
      workoutId,
      exerciseId: input.exerciseId,
      order: input.order ?? 0,
      notes: input.notes ?? null,
    })
    .returning();

  return { workoutExercise };
}

export async function logSet(
  db: Db,
  userId: string,
  workoutExerciseId: string,
  input: {
    setNumber: number;
    reps?: number;
    weightKg?: number;
    durationSeconds?: number;
    rpe?: number;
    notes?: string;
  }
) {
  // Verify ownership via join
  const [row] = await db
    .select({ workoutUserId: workouts.userId })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(and(eq(workoutExercises.id, workoutExerciseId), eq(workouts.userId, userId)));
  if (!row) return null;

  const [set] = await db
    .insert(sets)
    .values({
      id: randomUUID(),
      workoutExerciseId,
      setNumber: input.setNumber,
      reps: input.reps ?? null,
      weightKg: input.weightKg ?? null,
      durationSeconds: input.durationSeconds ?? null,
      rpe: input.rpe ?? null,
      notes: input.notes ?? null,
      loggedAt: new Date(),
    })
    .returning();

  return { set };
}
