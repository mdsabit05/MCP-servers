import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedTestUser, TEST_USER_ID, TEST_USER_2_ID } from "../setup.ts";
import { logWorkout, listWorkouts, getWorkout, completeWorkout } from "../../src/tools/workouts.ts";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedTestUser(sqlite);
});

describe("logWorkout", () => {
  it("creates a workout for the user", async () => {
    const result = await logWorkout(db, TEST_USER_ID, { name: "Monday Push" });
    expect(result.workout.name).toBe("Monday Push");
    expect(result.workout.userId).toBe(TEST_USER_ID);
    expect(result.workout.completedAt).toBeNull();
  });
});

describe("listWorkouts", () => {
  it("returns only workouts for the requesting user", async () => {
    await logWorkout(db, TEST_USER_ID, { name: "Alice Workout" });
    await logWorkout(db, TEST_USER_2_ID, { name: "Bob Workout" });

    const result = await listWorkouts(db, TEST_USER_ID, { limit: 10 });
    expect(result.workouts.length).toBe(1);
    expect(result.workouts[0].name).toBe("Alice Workout");
  });

  it("respects limit", async () => {
    for (let i = 0; i < 5; i++) await logWorkout(db, TEST_USER_ID, { name: `W${i}` });
    const result = await listWorkouts(db, TEST_USER_ID, { limit: 3 });
    expect(result.workouts.length).toBe(3);
  });
});

describe("getWorkout", () => {
  it("returns null for another user's workout", async () => {
    const { workout } = await logWorkout(db, TEST_USER_2_ID, { name: "Secret" });
    const result = await getWorkout(db, TEST_USER_ID, workout.id);
    expect(result).toBeNull();
  });

  it("returns workout for its owner", async () => {
    const { workout } = await logWorkout(db, TEST_USER_ID, { name: "My Workout" });
    const result = await getWorkout(db, TEST_USER_ID, workout.id);
    expect(result?.workout.id).toBe(workout.id);
  });
});

describe("completeWorkout", () => {
  it("sets completedAt timestamp", async () => {
    const { workout } = await logWorkout(db, TEST_USER_ID, {});
    const result = await completeWorkout(db, TEST_USER_ID, workout.id, { notes: "Great session" });
    expect(result?.workout.completedAt).not.toBeNull();
    expect(result?.workout.notes).toBe("Great session");
  });

  it("returns null for another user's workout", async () => {
    const { workout } = await logWorkout(db, TEST_USER_2_ID, {});
    const result = await completeWorkout(db, TEST_USER_ID, workout.id, {});
    expect(result).toBeNull();
  });
});
