import { eq } from "drizzle-orm";
import { routines, routineExercises } from "../db/schema.ts";
import type { db as DbType } from "../db/client.ts";
import { randomUUID } from "crypto";

type Db = typeof DbType;

export async function createRoutine(
  db: Db,
  userId: string,
  input: {
    name: string;
    description?: string;
    exercises: Array<{
      exerciseId: string;
      order?: number;
      targetSets?: number;
      targetReps?: number;
      targetWeightKg?: number;
    }>;
  }
) {
  const routineId = randomUUID();
  const [routine] = await db
    .insert(routines)
    .values({
      id: routineId,
      userId,
      name: input.name,
      description: input.description ?? null,
      createdAt: new Date(),
    })
    .returning();

  const exerciseRows =
    input.exercises.length > 0
      ? await db
          .insert(routineExercises)
          .values(
            input.exercises.map((e, i) => ({
              id: randomUUID(),
              routineId,
              exerciseId: e.exerciseId,
              order: e.order ?? i,
              targetSets: e.targetSets ?? 3,
              targetReps: e.targetReps ?? null,
              targetWeightKg: e.targetWeightKg ?? null,
            }))
          )
          .returning()
      : [];

  return { routine, exercises: exerciseRows };
}

export async function listRoutines(db: Db, userId: string) {
  const rows = await db
    .select()
    .from(routines)
    .where(eq(routines.userId, userId));

  const routinesWithExercises = await Promise.all(
    rows.map(async (r) => {
      const exercises = await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, r.id));
      return { ...r, exercises };
    })
  );

  return { routines: routinesWithExercises };
}
