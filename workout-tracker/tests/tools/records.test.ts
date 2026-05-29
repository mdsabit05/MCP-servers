import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedTestUser, TEST_USER_ID } from "../setup.ts";
import { getPersonalRecords } from "../../src/tools/records.ts";
import { logWorkout } from "../../src/tools/workouts.ts";
import { addExerciseToWorkout, logSet } from "../../src/tools/sets.ts";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedTestUser(sqlite);
});

describe("getPersonalRecords", () => {
  it("returns the max weight lifted for each exercise", async () => {
    const { workout } = await logWorkout(db, TEST_USER_ID, {});
    const res = await addExerciseToWorkout(db, TEST_USER_ID, workout.id, {
      exerciseId: "ex-squat",
    });
    const { workoutExercise } = res!;
    await logSet(db, TEST_USER_ID, workoutExercise.id, { setNumber: 1, reps: 5, weightKg: 100 });
    await logSet(db, TEST_USER_ID, workoutExercise.id, { setNumber: 2, reps: 3, weightKg: 120 });
    await logSet(db, TEST_USER_ID, workoutExercise.id, { setNumber: 3, reps: 1, weightKg: 140 });

    const result = await getPersonalRecords(db, TEST_USER_ID, {});
    const squat = result.records.find((r) => r.exerciseId === "ex-squat");
    expect(squat?.maxWeightKg).toBe(140);
    expect(squat?.maxWeightReps).toBe(1);
  });

  it("filters by exercise id", async () => {
    const { workout } = await logWorkout(db, TEST_USER_ID, {});
    const res = await addExerciseToWorkout(db, TEST_USER_ID, workout.id, {
      exerciseId: "ex-bench",
    });
    const { workoutExercise } = res!;
    await logSet(db, TEST_USER_ID, workoutExercise.id, { setNumber: 1, reps: 10, weightKg: 80 });

    const result = await getPersonalRecords(db, TEST_USER_ID, { exerciseId: "ex-bench" });
    expect(result.records.length).toBe(1);
    expect(result.records[0].maxWeightKg).toBe(80);
  });
});
