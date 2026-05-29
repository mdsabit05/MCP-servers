import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedTestUser, TEST_USER_ID, TEST_USER_2_ID } from "../setup.ts";
import { addExerciseToWorkout, logSet } from "../../src/tools/sets.ts";
import { logWorkout } from "../../src/tools/workouts.ts";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedTestUser(sqlite);
});

describe("addExerciseToWorkout", () => {
  it("creates a workout_exercise entry", async () => {
    const { workout } = await logWorkout(db, TEST_USER_ID, { name: "Push Day" });
    const result = await addExerciseToWorkout(db, TEST_USER_ID, workout.id, {
      exerciseId: "ex-bench",
      notes: "warm up first",
    });
    expect(result?.workoutExercise.exerciseId).toBe("ex-bench");
  });

  it("returns null if workout belongs to another user", async () => {
    const { workout } = await logWorkout(db, TEST_USER_2_ID, {});
    const result = await addExerciseToWorkout(db, TEST_USER_ID, workout.id, {
      exerciseId: "ex-bench",
    });
    expect(result).toBeNull();
  });
});

describe("logSet", () => {
  it("logs a set with weight and reps", async () => {
    const { workout } = await logWorkout(db, TEST_USER_ID, {});
    const res = await addExerciseToWorkout(db, TEST_USER_ID, workout.id, {
      exerciseId: "ex-bench",
    });
    const { workoutExercise } = res!;
    const result = await logSet(db, TEST_USER_ID, workoutExercise.id, {
      setNumber: 1,
      reps: 8,
      weightKg: 80,
      rpe: 7,
    });
    expect(result?.set.reps).toBe(8);
    expect(result?.set.weightKg).toBe(80);
  });
});
