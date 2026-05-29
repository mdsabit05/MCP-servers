import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "./db/client.ts";
import { logWorkout, listWorkouts, getWorkout, completeWorkout } from "./tools/workouts.ts";
import { listExercises, getExerciseHistory } from "./tools/exercises.ts";
import { addExerciseToWorkout, logSet } from "./tools/sets.ts";
import { createRoutine, listRoutines } from "./tools/routines.ts";
import { getPersonalRecords } from "./tools/records.ts";
import { getProgressReport, getWorkoutStats } from "./tools/analytics.ts";
import { recommendTodaysWorkout } from "./tools/recommendations.ts";

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: "workout-tracker",
    version: "1.0.0",
  });

  // ── Workout tools ──────────────────────────────────────────────────────────
  server.tool(
    "log_workout",
    "Start logging a new workout session. Returns the new workout ID.",
    {
      name: z.string().optional().describe("Optional name like 'Monday Push Day'"),
      notes: z.string().optional().describe("Any pre-workout notes"),
    },
    async (args) => {
      const result = await logWorkout(db, userId, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_workouts",
    "List your recent workout sessions, most recent first.",
    {
      limit: z.number().int().min(1).max(100).optional().default(20).describe("Max results"),
      offset: z.number().int().min(0).optional().default(0).describe("Pagination offset"),
    },
    async (args) => {
      const result = await listWorkouts(db, userId, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_workout",
    "Get full details of a workout including all exercises and sets.",
    {
      workoutId: z.string().describe("The workout ID to retrieve"),
    },
    async (args) => {
      const result = await getWorkout(db, userId, args.workoutId);
      if (!result) return { content: [{ type: "text", text: "Workout not found." }] };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "complete_workout",
    "Mark a workout as finished and optionally add closing notes.",
    {
      workoutId: z.string().describe("The workout ID to complete"),
      notes: z.string().optional().describe("How did the session go?"),
    },
    async (args) => {
      const result = await completeWorkout(db, userId, args.workoutId, { notes: args.notes });
      if (!result) return { content: [{ type: "text", text: "Workout not found or unauthorized." }] };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── Exercise tools ─────────────────────────────────────────────────────────
  server.tool(
    "list_exercises",
    "Browse the exercise catalog. Filter by muscle group or equipment.",
    {
      muscleGroup: z.string().optional().describe("E.g. 'legs', 'chest', 'back', 'shoulders'"),
      equipment: z.string().optional().describe("E.g. 'barbell', 'dumbbell', 'bodyweight'"),
    },
    async (args) => {
      const result = await listExercises(db, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_exercise_history",
    "Get time-series history for an exercise — great for seeing how a lift has progressed.",
    {
      exerciseId: z.string().describe("The exercise ID"),
      limit: z.number().int().min(1).max(500).optional().default(100),
      since: z.string().optional().describe("ISO date string, e.g. '2025-01-01'"),
    },
    async (args) => {
      const result = await getExerciseHistory(db, userId, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── Sets tools ─────────────────────────────────────────────────────────────
  server.tool(
    "add_exercise_to_workout",
    "Add an exercise to an in-progress workout session.",
    {
      workoutId: z.string().describe("The workout to add to"),
      exerciseId: z.string().describe("The exercise ID from list_exercises"),
      order: z.number().int().min(0).optional().describe("Position in workout (0-indexed)"),
      notes: z.string().optional().describe("E.g. 'warm up with empty bar'"),
    },
    async (args) => {
      const result = await addExerciseToWorkout(db, userId, args.workoutId, args);
      if (!result) return { content: [{ type: "text", text: "Workout not found or unauthorized." }] };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "log_set",
    "Log a single set within an exercise in a workout.",
    {
      workoutExerciseId: z.string().describe("The workout_exercise ID from add_exercise_to_workout"),
      setNumber: z.number().int().min(1).describe("Set number (1, 2, 3, ...)"),
      reps: z.number().int().min(0).optional().describe("Reps performed"),
      weightKg: z.number().min(0).optional().describe("Weight in kilograms"),
      durationSeconds: z.number().int().min(0).optional().describe("For timed exercises"),
      rpe: z.number().min(1).max(10).optional().describe("Rate of perceived exertion (1-10)"),
      notes: z.string().optional(),
    },
    async (args) => {
      const result = await logSet(db, userId, args.workoutExerciseId, args);
      if (!result) return { content: [{ type: "text", text: "Exercise not found or unauthorized." }] };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── Routines tools ─────────────────────────────────────────────────────────
  server.tool(
    "create_routine",
    "Save a workout template/routine you can follow repeatedly.",
    {
      name: z.string().describe("E.g. 'Stronglifts 5x5 Workout A'"),
      description: z.string().optional(),
      exercises: z
        .array(
          z.object({
            exerciseId: z.string(),
            order: z.number().int().min(0).optional(),
            targetSets: z.number().int().min(1).optional(),
            targetReps: z.number().int().min(1).optional(),
            targetWeightKg: z.number().min(0).optional(),
          })
        )
        .describe("Ordered list of exercises with targets"),
    },
    async (args) => {
      const result = await createRoutine(db, userId, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_routines",
    "List all your saved workout routines with their exercises.",
    {},
    async () => {
      const result = await listRoutines(db, userId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── Records & analytics tools ──────────────────────────────────────────────
  server.tool(
    "get_personal_records",
    "Get your personal records (heaviest weight lifted) for each exercise.",
    {
      exerciseId: z.string().optional().describe("Filter to a specific exercise, or omit for all"),
    },
    async (args) => {
      const result = await getPersonalRecords(db, userId, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_progress_report",
    "See how an exercise has progressed over time — volume, max weight, and reps per session.",
    {
      exerciseId: z.string().describe("The exercise to analyse"),
      period: z
        .enum(["week", "month", "year", "all"])
        .optional()
        .default("year")
        .describe("Time window"),
    },
    async (args) => {
      const result = await getProgressReport(db, userId, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_workout_stats",
    "Get aggregate stats: total sessions, total volume lifted, and total sets in a time period.",
    {
      period: z
        .enum(["week", "month", "year", "all"])
        .optional()
        .default("month"),
    },
    async (args) => {
      const result = await getWorkoutStats(db, userId, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── Generative tool ────────────────────────────────────────────────────────
  server.tool(
    "recommend_todays_workout",
    "Ask 'what should I do today?' — returns a smart recommendation based on your routines, recent training, and recovery time.",
    {},
    async () => {
      const result = await recommendTodaysWorkout(db, userId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}
