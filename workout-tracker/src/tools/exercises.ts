import { eq, and, desc } from "drizzle-orm";
import { exercises, sets, workoutExercises, workouts } from "../db/schema.ts";
import type { db as DbType } from "../db/client.ts";

type Db = typeof DbType;

export async function listExercises(db: Db, input: { muscleGroup?: string; equipment?: string }) {
  const conditions = [];
  if (input.muscleGroup) conditions.push(eq(exercises.muscleGroup, input.muscleGroup));
  if (input.equipment) conditions.push(eq(exercises.equipment!, input.equipment));

  const rows =
    conditions.length > 0
      ? await db.select().from(exercises).where(and(...conditions))
      : await db.select().from(exercises);

  return { exercises: rows };
}

export async function getExerciseHistory(
  db: Db,
  userId: string,
  input: { exerciseId: string; limit?: number; since?: string }
) {
  const limit = input.limit ?? 100;

  const query = db
    .select({
      setId: sets.id,
      setNumber: sets.setNumber,
      reps: sets.reps,
      weightKg: sets.weightKg,
      durationSeconds: sets.durationSeconds,
      rpe: sets.rpe,
      loggedAt: sets.loggedAt,
      workoutId: workouts.id,
      workoutName: workouts.name,
      workoutDate: workouts.startedAt,
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(sets.workoutExerciseId, workoutExercises.id))
    .innerJoin(workouts, and(eq(workoutExercises.workoutId, workouts.id), eq(workouts.userId, userId)))
    .where(eq(workoutExercises.exerciseId, input.exerciseId))
    .orderBy(desc(sets.loggedAt))
    .limit(limit);

  const rows = await query;
  return { history: rows };
}
