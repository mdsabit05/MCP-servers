import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedTestUser, TEST_USER_ID, TEST_USER_2_ID } from "../setup.ts";
import { createRoutine, listRoutines } from "../../src/tools/routines.ts";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedTestUser(sqlite);
});

describe("createRoutine", () => {
  it("creates a routine with exercises", async () => {
    const result = await createRoutine(db, TEST_USER_ID, {
      name: "Stronglifts 5x5",
      description: "Barbell compound movements",
      exercises: [
        { exerciseId: "ex-squat", order: 0, targetSets: 5, targetReps: 5 },
        { exerciseId: "ex-bench", order: 1, targetSets: 5, targetReps: 5 },
        { exerciseId: "ex-row", order: 2, targetSets: 5, targetReps: 5 },
      ],
    });
    expect(result.routine.name).toBe("Stronglifts 5x5");
    expect(result.exercises.length).toBe(3);
  });
});

describe("listRoutines", () => {
  it("returns only the user's routines", async () => {
    await createRoutine(db, TEST_USER_ID, { name: "Alice Routine", exercises: [] });
    await createRoutine(db, TEST_USER_2_ID, { name: "Bob Routine", exercises: [] });

    const result = await listRoutines(db, TEST_USER_ID);
    expect(result.routines.length).toBe(1);
    expect(result.routines[0].name).toBe("Alice Routine");
  });
});
