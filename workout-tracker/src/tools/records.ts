import { eq, and, max } from "drizzle-orm";
import { sets, workoutExercises, workouts, exercises } from "../db/schema.ts";
import type { db as DbType } from "../db/client.ts";

type Db = typeof DbType;

export async function getPersonalRecords(
  db: Db,
  userId: string,
  input: { exerciseId?: string }
) {
  const conditions = [eq(workouts.userId, userId)];
  if (input.exerciseId) conditions.push(eq(workoutExercises.exerciseId, input.exerciseId));

  // Step 1: Get max weight per exercise
  const maxRows = await db
    .select({
      exerciseId: workoutExercises.exerciseId,
      exerciseName: exercises.name,
      muscleGroup: exercises.muscleGroup,
      maxWeightKg: max(sets.weightKg),
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(sets.workoutExerciseId, workoutExercises.id))
    .innerJoin(workouts, and(eq(workoutExercises.workoutId, workouts.id), eq(workouts.userId, userId)))
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(and(...conditions))
    .groupBy(workoutExercises.exerciseId, exercises.name, exercises.muscleGroup);

  // Step 2: For each exercise, find the reps at that max weight
  const records = await Promise.all(
    maxRows.map(async (row) => {
      if (row.maxWeightKg == null) return { ...row, maxWeightReps: null };

      const [bestSet] = await db
        .select({ reps: sets.reps })
        .from(sets)
        .innerJoin(workoutExercises, eq(sets.workoutExerciseId, workoutExercises.id))
        .innerJoin(workouts, and(eq(workoutExercises.workoutId, workouts.id), eq(workouts.userId, userId)))
        .where(
          and(
            eq(workoutExercises.exerciseId, row.exerciseId),
            eq(sets.weightKg, row.maxWeightKg)
          )
        )
        .limit(1);

      return { ...row, maxWeightReps: bestSet?.reps ?? null };
    })
  );

  return { records };
}
