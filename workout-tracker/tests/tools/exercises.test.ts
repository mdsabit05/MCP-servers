import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedTestUser, TEST_USER_ID } from "../setup.ts";
import { listExercises, getExerciseHistory } from "../../src/tools/exercises.ts";
import { logWorkout } from "../../src/tools/workouts.ts";
import { addExerciseToWorkout, logSet } from "../../src/tools/sets.ts";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedTestUser(sqlite);
});

describe("listExercises", () => {
  it("returns all exercises", async () => {
    const result = await listExercises(db, {});
    expect(result.exercises.length).toBe(5);
  });

  it("filters by muscle group", async () => {
    const result = await listExercises(db, { muscleGroup: "legs" });
    expect(result.exercises.every((e) => e.muscleGroup === "legs")).toBe(true);
  });
});

describe("getExerciseHistory", () => {
  it("returns time-series sets for a user's exercise", async () => {
    const { workout } = await logWorkout(db, TEST_USER_ID, { name: "Leg Day" });
    const res = await addExerciseToWorkout(db, TEST_USER_ID, workout.id, {
      exerciseId: "ex-squat",
    });
    const { workoutExercise } = res!;
    await logSet(db, TEST_USER_ID, workoutExercise.id, { setNumber: 1, reps: 5, weightKg: 100 });
    await logSet(db, TEST_USER_ID, workoutExercise.id, { setNumber: 2, reps: 5, weightKg: 105 });

    const result = await getExerciseHistory(db, TEST_USER_ID, {
      exerciseId: "ex-squat",
      limit: 50,
    });
    expect(result.history.length).toBe(2);
  });
});
