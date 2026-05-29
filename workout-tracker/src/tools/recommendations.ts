import { eq, and, desc, gte, sql } from "drizzle-orm";
import { workouts, workoutExercises, exercises, routines, routineExercises } from "../db/schema.ts";
import type { db as DbType } from "../db/client.ts";

type Db = typeof DbType;

export async function recommendTodaysWorkout(db: Db, userId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  // Check if user already completed a workout today
  const [todayWorkout] = await db
    .select({ id: workouts.id, name: workouts.name })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.startedAt, todayStart),
        sql`${workouts.completedAt} IS NOT NULL`
      )
    )
    .limit(1);

  if (todayWorkout) {
    return {
      recommendation: `You've already completed "${todayWorkout.name ?? "a workout"}" today — great work! Rest up and recover. Consider light stretching or a walk.`,
      suggestedExercises: [],
      reasoning: "Workout already completed today.",
    };
  }

  // Get recent completed workouts with exercises for the last 7 days
  const recentWorkouts = await db
    .select({
      workoutId: workouts.id,
      workoutName: workouts.name,
      completedAt: workouts.completedAt,
      exerciseId: workoutExercises.exerciseId,
      muscleGroup: exercises.muscleGroup,
    })
    .from(workouts)
    .innerJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.startedAt, sevenDaysAgo),
        sql`${workouts.completedAt} IS NOT NULL`
      )
    )
    .orderBy(desc(workouts.completedAt));

  const recentMuscleGroups = new Set(recentWorkouts.map((r) => r.muscleGroup));

  // Fetch user's routines
  const userRoutines = await db
    .select()
    .from(routines)
    .where(eq(routines.userId, userId));

  if (userRoutines.length === 0 && recentWorkouts.length === 0) {
    // Brand new user — generic onboarding recommendation
    const allExercises = await db.select().from(exercises).limit(5);
    return {
      recommendation:
        "Welcome! Since you're just getting started, here's a beginner full-body workout. Focus on form over weight.",
      suggestedExercises: allExercises.map((e) => ({
        exerciseId: e.id,
        exerciseName: e.name,
        muscleGroup: e.muscleGroup,
        targetSets: 3,
        targetReps: 8,
      })),
      reasoning: "No workout history or routines found — using beginner defaults.",
    };
  }

  if (userRoutines.length === 0) {
    // Has history but no routines — suggest least recently trained muscles
    const allExercises = await db.select().from(exercises);
    const fresh = allExercises.filter((e) => !recentMuscleGroups.has(e.muscleGroup));
    const suggested = (fresh.length > 0 ? fresh : allExercises).slice(0, 4);

    return {
      recommendation: `You haven't trained ${[...new Set(suggested.map((e) => e.muscleGroup))].join(", ")} recently. Here's a suggested session.`,
      suggestedExercises: suggested.map((e) => ({
        exerciseId: e.id,
        exerciseName: e.name,
        muscleGroup: e.muscleGroup,
        targetSets: 3,
        targetReps: 10,
      })),
      reasoning: `Recent muscle groups: ${[...recentMuscleGroups].join(", ") || "none"}.`,
    };
  }

  // Pick the routine whose exercises overlap least with recent training
  const routinesWithExercises = await Promise.all(
    userRoutines.map(async (r) => {
      const exs = await db
        .select({
          exerciseId: routineExercises.exerciseId,
          targetSets: routineExercises.targetSets,
          targetReps: routineExercises.targetReps,
          targetWeightKg: routineExercises.targetWeightKg,
          order: routineExercises.order,
        })
        .from(routineExercises)
        .where(eq(routineExercises.routineId, r.id))
        .orderBy(routineExercises.order);
      return { ...r, exercises: exs };
    })
  );

  const recentExerciseIds = new Set(recentWorkouts.map((w) => w.exerciseId));
  const scored = routinesWithExercises.map((r) => {
    const exerciseIds = new Set(r.exercises.map((e) => e.exerciseId));
    const overlap = [...exerciseIds].filter((id) => recentExerciseIds.has(id)).length;
    return { ...r, overlap };
  });

  scored.sort((a, b) => a.overlap - b.overlap);
  const chosen = scored[0];

  // Enrich with exercise names
  const enriched = await Promise.all(
    chosen.exercises.map(async (re) => {
      const [exercise] = await db
        .select()
        .from(exercises)
        .where(eq(exercises.id, re.exerciseId));
      return {
        exerciseId: re.exerciseId,
        exerciseName: exercise?.name ?? re.exerciseId,
        muscleGroup: exercise?.muscleGroup ?? "unknown",
        targetSets: re.targetSets,
        targetReps: re.targetReps,
        targetWeightKg: re.targetWeightKg,
      };
    })
  );

  const lastWorkout = recentWorkouts[0];
  const daysSinceLast =
    lastWorkout?.completedAt
      ? Math.floor((now.getTime() - new Date(lastWorkout.completedAt).getTime()) / 86400000)
      : null;

  const recencyNote =
    daysSinceLast === null
      ? "You haven't logged a workout recently."
      : daysSinceLast === 0
      ? "You trained earlier today."
      : daysSinceLast === 1
      ? "You trained yesterday."
      : `It's been ${daysSinceLast} days since your last workout.`;

  return {
    recommendation: `${recencyNote} Based on your routines and recent training, "${chosen.name}" looks like the best fit today.`,
    routineId: chosen.id,
    routineName: chosen.name,
    suggestedExercises: enriched,
    reasoning: `Chose routine with least overlap (${chosen.overlap} exercises) with your last 7 days of training.`,
  };
}
