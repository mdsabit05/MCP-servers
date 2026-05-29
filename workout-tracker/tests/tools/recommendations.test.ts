import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedTestUser, TEST_USER_ID } from "../setup.ts";
import { recommendTodaysWorkout } from "../../src/tools/recommendations.ts";
import { createRoutine } from "../../src/tools/routines.ts";
import { logWorkout, completeWorkout } from "../../src/tools/workouts.ts";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedTestUser(sqlite);
});

describe("recommendTodaysWorkout", () => {
  it("suggests a routine when user has no recent workout", async () => {
    await createRoutine(db, TEST_USER_ID, {
      name: "Full Body A",
      exercises: [
        { exerciseId: "ex-squat", order: 0, targetSets: 3, targetReps: 5 },
        { exerciseId: "ex-bench", order: 1, targetSets: 3, targetReps: 5 },
      ],
    });

    const result = await recommendTodaysWorkout(db, TEST_USER_ID);
    expect(result.recommendation).toContain("Full Body A");
    expect(result.suggestedExercises.length).toBeGreaterThan(0);
  });

  it("suggests rest when a workout was completed today", async () => {
    const { workout } = await logWorkout(db, TEST_USER_ID, { name: "Today's Workout" });
    await completeWorkout(db, TEST_USER_ID, workout.id, {});

    const result = await recommendTodaysWorkout(db, TEST_USER_ID);
    expect(result.recommendation.toLowerCase()).toMatch(/rest|recover|already/);
  });

  it("returns a recommendation even with no data", async () => {
    const result = await recommendTodaysWorkout(db, TEST_USER_ID);
    expect(result.recommendation).toBeTruthy();
    expect(typeof result.recommendation).toBe("string");
  });
});
