import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedTestUser, TEST_USER_ID } from "../setup.ts";
import { getProgressReport, getWorkoutStats } from "../../src/tools/analytics.ts";
import { logWorkout, completeWorkout } from "../../src/tools/workouts.ts";
import { addExerciseToWorkout, logSet } from "../../src/tools/sets.ts";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedTestUser(sqlite);
});

async function seedWorkoutsWithSets() {
  const { workout: w1 } = await logWorkout(db, TEST_USER_ID, { name: "Squat Day 1" });
  const res1 = await addExerciseToWorkout(db, TEST_USER_ID, w1.id, { exerciseId: "ex-squat" });
  await logSet(db, TEST_USER_ID, res1!.workoutExercise.id, { setNumber: 1, reps: 5, weightKg: 80 });
  await completeWorkout(db, TEST_USER_ID, w1.id, {});

  const { workout: w2 } = await logWorkout(db, TEST_USER_ID, { name: "Squat Day 2" });
  const res2 = await addExerciseToWorkout(db, TEST_USER_ID, w2.id, { exerciseId: "ex-squat" });
  await logSet(db, TEST_USER_ID, res2!.workoutExercise.id, { setNumber: 1, reps: 5, weightKg: 90 });
  await completeWorkout(db, TEST_USER_ID, w2.id, {});
}

describe("getProgressReport", () => {
  it("returns data points grouped by workout", async () => {
    await seedWorkoutsWithSets();
    const result = await getProgressReport(db, TEST_USER_ID, {
      exerciseId: "ex-squat",
      period: "month",
    });
    expect(result.dataPoints.length).toBeGreaterThan(0);
    expect(result.exerciseName).toBe("Barbell Squat");
  });
});

describe("getWorkoutStats", () => {
  it("returns total sessions and total volume", async () => {
    await seedWorkoutsWithSets();
    const result = await getWorkoutStats(db, TEST_USER_ID, { period: "month" });
    expect(result.totalSessions).toBe(2);
    expect(result.totalVolumeKg).toBeGreaterThan(0);
  });
});
