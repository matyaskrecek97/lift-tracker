import fs from "node:fs/promises";
import path from "node:path";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod3";
import { verifyEquipmentAccess, verifyPlaceAccess } from "./api-utils";
import {
  getExercises,
  getWorkout,
  getWorkouts,
  serializeWorkout,
} from "./data";
import prisma, { workoutFullInclude } from "./prisma";

function extractUserId(extra: { authInfo?: AuthInfo }): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new Error("Not authenticated");
  return userId;
}

function json(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function error(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

async function findOwnedWorkout(workoutId: string, userId: string) {
  return prisma.workout.findFirst({ where: { id: workoutId, userId } });
}

async function findOwnedWorkoutExercise(
  workoutExerciseId: string,
  userId: string,
) {
  const we = await prisma.workoutExercise.findFirst({
    where: { id: workoutExerciseId },
    include: { workout: { select: { userId: true } } },
  });
  if (!we || we.workout.userId !== userId) return null;
  return we;
}

const RESOURCE_URI = "ui://lift-tracker/workout-editor.html";
const MCP_UI_DIST = path.join(process.cwd(), "mcp-ui", "dist", "mcp-app.html");

export function registerTools(server: McpServer) {
  // ── App Resource ────────────────────────────────────────────────────────────

  registerAppResource(
    server,
    "Workout Editor",
    RESOURCE_URI,
    { description: "Interactive workout editor UI" },
    async () => {
      const html = await fs.readFile(MCP_UI_DIST, "utf-8");
      return {
        contents: [
          { uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  // ── Reads ──────────────────────────────────────────────────────────────────

  server.registerTool(
    "list_workouts",
    {
      title: "List Workouts",
      description:
        "List the user's recent workouts with summaries (id, name, date, exercise count, finished status).",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max workouts to return (default 20)"),
      },
    },
    async ({ limit }, extra) => {
      const userId = extractUserId(extra);
      const workouts = await getWorkouts(userId, limit ?? 20);
      const summaries = workouts.map((w) => ({
        id: w.id,
        name: w.name,
        startedAt: w.startedAt,
        endedAt: w.endedAt,
        exerciseCount: w.exercises.length,
        totalSets: w.exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
        finished: !!w.endedAt,
      }));
      return json(summaries);
    },
  );

  registerAppTool(
    server,
    "get_workout",
    {
      title: "Get Workout Details",
      description:
        "Get full details of a workout including all exercises, sets, equipment, and body parts. Opens an interactive editor UI.",
      inputSchema: {
        workoutId: z.string().describe("The workout ID"),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ workoutId }, extra) => {
      const userId = extractUserId(extra);
      const workout = await getWorkout(userId, workoutId);
      if (!workout) return error("Workout not found");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(workout, null, 2) },
        ],
        structuredContent: workout as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "search_exercises",
    {
      title: "Search Exercises",
      description:
        "Search the exercise catalog by name. Returns exercises with body part and equipment info.",
      inputSchema: {
        query: z.string().describe("Search query (matches exercise name)"),
      },
    },
    async ({ query }, extra) => {
      const userId = extractUserId(extra);
      const exercises = await getExercises(userId, query);
      return json(exercises);
    },
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  registerAppTool(
    server,
    "create_workout",
    {
      title: "Create Workout",
      description:
        "Start a new workout. Optionally create from a template or at a specific place. Opens an interactive editor UI.",
      inputSchema: {
        name: z.string().max(100).optional().describe("Workout name"),
        templateId: z
          .string()
          .optional()
          .describe("Template ID to copy exercises from"),
        placeId: z.string().optional().describe("Place/gym ID"),
        notes: z.string().max(500).optional().describe("Workout notes"),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ name, templateId, placeId, notes }, extra) => {
      const userId = extractUserId(extra);

      if (placeId && !(await verifyPlaceAccess(placeId, userId))) {
        return error("Invalid place ID");
      }

      let exercisesToCreate: {
        exerciseId: string;
        equipmentId?: string | null;
        order: number;
      }[] = [];
      let workoutName = name;

      if (templateId) {
        const template = await prisma.workoutTemplate.findFirst({
          where: { id: templateId, userId },
          include: {
            items: {
              orderBy: { order: "asc" },
              include: { exercise: { select: { equipmentId: true } } },
            },
          },
        });

        if (template) {
          exercisesToCreate = template.items.map((item) => ({
            exerciseId: item.exerciseId,
            equipmentId: item.equipmentId ?? item.exercise.equipmentId,
            order: item.order,
          }));
          if (!workoutName) workoutName = template.name;
        }
      }

      const workout = await prisma.workout.create({
        data: {
          userId,
          name: workoutName,
          placeId,
          notes,
          exercises: { create: exercisesToCreate },
        },
        include: workoutFullInclude,
      });

      const serialized = serializeWorkout(workout);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(serialized, null, 2) },
        ],
        structuredContent: serialized as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "update_workout",
    {
      title: "Update Workout",
      description: "Edit workout metadata (name, notes, place, timestamps).",
      inputSchema: {
        workoutId: z.string().describe("The workout ID"),
        name: z.string().max(100).optional().describe("New name"),
        notes: z.string().max(500).optional().nullable().describe("New notes"),
        placeId: z.string().optional().nullable().describe("New place ID"),
        startedAt: z
          .string()
          .datetime()
          .optional()
          .describe("ISO date string for start time"),
        endedAt: z
          .string()
          .datetime()
          .optional()
          .nullable()
          .describe("ISO date string for end time"),
      },
    },
    async ({ workoutId, name, notes, placeId, startedAt, endedAt }, extra) => {
      const userId = extractUserId(extra);
      if (!(await findOwnedWorkout(workoutId, userId)))
        return error("Workout not found");

      if (placeId && !(await verifyPlaceAccess(placeId, userId))) {
        return error("Invalid place ID");
      }

      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (notes !== undefined) data.notes = notes;
      if (placeId !== undefined) data.placeId = placeId;
      if (startedAt !== undefined) data.startedAt = new Date(startedAt);
      if (endedAt !== undefined)
        data.endedAt = endedAt ? new Date(endedAt) : null;

      const workout = await prisma.workout.update({
        where: { id: workoutId },
        data,
        include: workoutFullInclude,
      });

      return json(serializeWorkout(workout));
    },
  );

  server.registerTool(
    "finish_workout",
    {
      title: "Finish Workout",
      description: "Mark a workout as complete by setting endedAt to now.",
      inputSchema: {
        workoutId: z.string().describe("The workout ID"),
      },
    },
    async ({ workoutId }, extra) => {
      const userId = extractUserId(extra);
      if (!(await findOwnedWorkout(workoutId, userId)))
        return error("Workout not found");

      const workout = await prisma.workout.update({
        where: { id: workoutId },
        data: { endedAt: new Date() },
        include: workoutFullInclude,
      });

      return json(serializeWorkout(workout));
    },
  );

  server.registerTool(
    "delete_workout",
    {
      title: "Delete Workout",
      description: "Archive a workout (soft delete).",
      inputSchema: {
        workoutId: z.string().describe("The workout ID"),
      },
    },
    async ({ workoutId }, extra) => {
      const userId = extractUserId(extra);
      if (!(await findOwnedWorkout(workoutId, userId)))
        return error("Workout not found");

      await prisma.workout.update({
        where: { id: workoutId },
        data: { isArchived: true },
      });

      return json({ success: true, workoutId });
    },
  );

  server.registerTool(
    "add_exercise_to_workout",
    {
      title: "Add Exercise to Workout",
      description:
        "Add an exercise to a workout. Use search_exercises first to find the exercise ID.",
      inputSchema: {
        workoutId: z.string().describe("The workout ID"),
        exerciseId: z
          .string()
          .describe("The catalog exercise ID (from search_exercises)"),
        equipmentId: z.string().optional().describe("Equipment override ID"),
        order: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Position in the workout (appends to end if omitted)"),
      },
    },
    async ({ workoutId, exerciseId, equipmentId, order }, extra) => {
      const userId = extractUserId(extra);
      const workout = await prisma.workout.findFirst({
        where: { id: workoutId, userId },
        include: { exercises: { select: { order: true } } },
      });
      if (!workout) return error("Workout not found");

      const exercise = await prisma.exercise.findFirst({
        where: {
          id: exerciseId,
          OR: [{ isPublic: true }, { createdById: userId }],
        },
      });
      if (!exercise) return error("Exercise not found");

      if (equipmentId && !(await verifyEquipmentAccess(equipmentId, userId))) {
        return error("Invalid equipment ID");
      }

      const maxOrder = workout.exercises.reduce(
        (max, e) => Math.max(max, e.order),
        -1,
      );

      const workoutExercise = await prisma.workoutExercise.create({
        data: {
          workoutId,
          exerciseId,
          equipmentId: equipmentId || null,
          order: order ?? maxOrder + 1,
        },
        include: {
          exercise: {
            include: {
              primaryBodyPart: true,
              secondaryBodyParts: true,
              equipment: true,
            },
          },
          equipment: true,
          sets: { orderBy: { order: "asc" } },
        },
      });

      return json(workoutExercise);
    },
  );

  server.registerTool(
    "log_set",
    {
      title: "Log Set",
      description: "Log a set (reps + weight) for a workout exercise.",
      inputSchema: {
        workoutExerciseId: z
          .string()
          .describe(
            "The workout exercise ID (from get_workout or add_exercise_to_workout)",
          ),
        reps: z.number().int().min(1).max(999).describe("Number of reps"),
        weightKg: z
          .number()
          .min(0)
          .max(9999.99)
          .describe("Weight in kilograms"),
        isWarmup: z
          .boolean()
          .optional()
          .describe("Whether this is a warmup set (default false)"),
        order: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Position in the set list (appends to end if omitted)"),
      },
    },
    async ({ workoutExerciseId, reps, weightKg, isWarmup, order }, extra) => {
      const userId = extractUserId(extra);
      if (!(await findOwnedWorkoutExercise(workoutExerciseId, userId)))
        return error("Workout exercise not found");

      const withSets = await prisma.workoutExercise.findFirst({
        where: { id: workoutExerciseId },
        include: { sets: { select: { order: true } } },
      });

      const maxOrder = (withSets?.sets ?? []).reduce(
        (max, s) => Math.max(max, s.order),
        -1,
      );

      const set = await prisma.workoutSet.create({
        data: {
          workoutExerciseId,
          reps,
          weightKg,
          isWarmup: isWarmup ?? false,
          order: order ?? maxOrder + 1,
        },
      });

      return json({
        ...set,
        weightKg: Number(set.weightKg),
      });
    },
  );

  server.registerTool(
    "update_set",
    {
      title: "Update Set",
      description: "Edit an existing set's reps, weight, or warmup status.",
      inputSchema: {
        workoutExerciseId: z
          .string()
          .describe("The workout exercise ID that owns this set"),
        setId: z.string().describe("The set ID to update"),
        reps: z.number().int().min(1).max(999).optional().describe("New reps"),
        weightKg: z
          .number()
          .min(0)
          .max(9999.99)
          .optional()
          .describe("New weight in kilograms"),
        isWarmup: z
          .boolean()
          .optional()
          .describe("Whether this is a warmup set"),
      },
    },
    async ({ workoutExerciseId, setId, reps, weightKg, isWarmup }, extra) => {
      const userId = extractUserId(extra);
      if (!(await findOwnedWorkoutExercise(workoutExerciseId, userId)))
        return error("Workout exercise not found");

      const existing = await prisma.workoutSet.findFirst({
        where: { id: setId, workoutExerciseId },
      });
      if (!existing) return error("Set not found");

      const data: Record<string, unknown> = {};
      if (reps !== undefined) data.reps = reps;
      if (weightKg !== undefined) data.weightKg = weightKg;
      if (isWarmup !== undefined) data.isWarmup = isWarmup;

      const set = await prisma.workoutSet.update({
        where: { id: setId },
        data,
      });

      return json({ ...set, weightKg: Number(set.weightKg) });
    },
  );

  server.registerTool(
    "delete_set",
    {
      title: "Delete Set",
      description: "Remove a set from a workout exercise.",
      inputSchema: {
        workoutExerciseId: z
          .string()
          .describe("The workout exercise ID that owns this set"),
        setId: z.string().describe("The set ID to delete"),
      },
    },
    async ({ workoutExerciseId, setId }, extra) => {
      const userId = extractUserId(extra);
      if (!(await findOwnedWorkoutExercise(workoutExerciseId, userId)))
        return error("Workout exercise not found");

      const existing = await prisma.workoutSet.findFirst({
        where: { id: setId, workoutExerciseId },
      });
      if (!existing) return error("Set not found");

      await prisma.workoutSet.delete({ where: { id: setId } });

      return json({ success: true, setId });
    },
  );

  server.registerTool(
    "remove_exercise_from_workout",
    {
      title: "Remove Exercise from Workout",
      description: "Remove an exercise and all its sets from a workout.",
      inputSchema: {
        workoutId: z.string().describe("The workout ID"),
        workoutExerciseId: z
          .string()
          .describe("The workout exercise ID to remove"),
      },
    },
    async ({ workoutId, workoutExerciseId }, extra) => {
      const userId = extractUserId(extra);
      if (!(await findOwnedWorkout(workoutId, userId)))
        return error("Workout not found");

      const workoutExercise = await prisma.workoutExercise.findFirst({
        where: { id: workoutExerciseId, workoutId },
      });
      if (!workoutExercise) return error("Workout exercise not found");

      await prisma.workoutExercise.delete({
        where: { id: workoutExerciseId },
      });

      return json({ success: true, workoutExerciseId });
    },
  );
}
