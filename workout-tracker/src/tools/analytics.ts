import { eq, and, gte, sql, count } from "drizzle-orm";
import { sets, workoutExercises, workouts, exercises } from "../db/schema.ts";
import type { db as DbType } from "../db/client.ts";

type Db = typeof DbType;
type Period = "week" | "month" | "year" | "all";

function periodStart(period: Period): Date | null {
  const now = new Date();
  if (period === "week") return new Date(now.getTime() - 7 * 86400000);
  if (period === "month") return new Date(now.getTime() - 30 * 86400000);
  if (period === "year") return new Date(now.getTime() - 365 * 86400000);
  return null;
}

export async function getProgressReport(
  db: Db,
  userId: string,
  input: { exerciseId: string; period?: Period }
) {
  const period = input.period ?? "year";
  const since = periodStart(period);

  const [exercise] = await db
    .select({ name: exercises.name })
    .from(exercises)
    .where(eq(exercises.id, input.exerciseId));

  const conditions = [
    eq(workouts.userId, userId),
    eq(workoutExercises.exerciseId, input.exerciseId),
  ];
  if (since) conditions.push(gte(workouts.startedAt, since));

  const rows = await db
    .select({
      workoutDate: workouts.startedAt,
      workoutName: workouts.name,
      maxWeightKg: sql<number>`MAX(${sets.weightKg})`,
      totalVolume: sql<number>`SUM(${sets.weightKg} * ${sets.reps})`,
      totalReps: sql<number>`SUM(${sets.reps})`,
      setCount: count(sets.id),
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(sets.workoutExerciseId, workoutExercises.id))
    .innerJoin(workouts, and(eq(workoutExercises.workoutId, workouts.id), eq(workouts.userId, userId)))
    .where(and(...conditions))
    .groupBy(workouts.id, workouts.startedAt, workouts.name)
    .orderBy(workouts.startedAt);

  return {
    exerciseId: input.exerciseId,
    exerciseName: exercise?.name ?? input.exerciseId,
    period,
    dataPoints: rows,
  };
}

export async function getWorkoutStats(
  db: Db,
  userId: string,
  input: { period?: Period }
) {
  const period = input.period ?? "month";
  const since = periodStart(period);

  const sessionConditions = [eq(workouts.userId, userId)];
  if (since) sessionConditions.push(gte(workouts.startedAt, since));

  const [stats] = await db
    .select({
      totalSessions: count(workouts.id),
    })
    .from(workouts)
    .where(and(...sessionConditions));

  const volumeConditions = [eq(workouts.userId, userId)];
  if (since) volumeConditions.push(gte(workouts.startedAt, since));

  const [volumeRow] = await db
    .select({
      totalVolumeKg: sql<number>`COALESCE(SUM(${sets.weightKg} * ${sets.reps}), 0)`,
      totalSets: count(sets.id),
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(sets.workoutExerciseId, workoutExercises.id))
    .innerJoin(workouts, and(eq(workoutExercises.workoutId, workouts.id), eq(workouts.userId, userId)))
    .where(and(...volumeConditions));

  return {
    period,
    totalSessions: stats?.totalSessions ?? 0,
    totalVolumeKg: volumeRow?.totalVolumeKg ?? 0,
    totalSets: volumeRow?.totalSets ?? 0,
  };
}
