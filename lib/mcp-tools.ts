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
import {
  verifyEquipmentAccess,
  verifyExerciseAccess,
  verifyPlaceAccess,
} from "./api-utils";
import {
  getExercises,
  getPlaces,
  getTemplate,
  getWorkout,
  getWorkouts,
  serializeWorkout,
} from "./data";
import { searchExerciseWithAI } from "./exercise-agent";
import prisma, { templateFullInclude, workoutFullInclude } from "./prisma";
import { generateWorkoutTitle } from "./utils";

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

async function findOwnedTemplate(templateId: string, userId: string) {
  return prisma.workoutTemplate.findFirst({
    where: { id: templateId, userId },
  });
}

function generateExerciseSlug(name: string, userId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `${base}_${userId.slice(0, 8)}`;
}

const WORKOUT_RESOURCE_URI = "ui://lift-tracker/workout-editor.html";
const WORKOUT_UI_DIST = path.join(
  process.cwd(),
  "mcp-ui",
  "dist",
  "mcp-app.html",
);

const TEMPLATE_RESOURCE_URI = "ui://lift-tracker/template-editor.html";
const TEMPLATE_UI_DIST = path.join(
  process.cwd(),
  "mcp-ui",
  "dist",
  "template-app.html",
);

export function registerTools(server: McpServer) {
  // ── App Resources ───────────────────────────────────────────────────────────

  registerAppResource(
    server,
    "Workout Editor",
    WORKOUT_RESOURCE_URI,
    { description: "Interactive workout editor UI" },
    async () => {
      const html = await fs.readFile(WORKOUT_UI_DIST, "utf-8");
      return {
        contents: [
          {
            uri: WORKOUT_RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
          },
        ],
      };
    },
  );

  registerAppResource(
    server,
    "Template Editor",
    TEMPLATE_RESOURCE_URI,
    { description: "Interactive workout template editor UI" },
    async () => {
      const html = await fs.readFile(TEMPLATE_UI_DIST, "utf-8");
      return {
        contents: [
          {
            uri: TEMPLATE_RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
          },
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
        "List the user's recent workouts with summaries. Supports filtering by place and sort order.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max workouts to return (default 20)"),
        placeId: z
          .string()
          .optional()
          .describe("Filter by place/gym ID (use list_places to find IDs)"),
        sort: z
          .enum(["newest", "oldest"])
          .optional()
          .describe("Sort order by date (default newest)"),
      },
    },
    async ({ limit, placeId, sort }, extra) => {
      const userId = extractUserId(extra);
      const workouts = await getWorkouts(userId, limit ?? 20, {
        placeId,
        sort,
      });
      const summaries = workouts.map((w) => ({
        id: w.id,
        name: w.name,
        startedAt: w.startedAt,
        endedAt: w.endedAt,
        exerciseCount: w.exercises.length,
        totalSets: w.exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
        finished: !!w.endedAt,
        place: w.place ? { id: w.place.id, name: w.place.name } : null,
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
      _meta: { ui: { resourceUri: WORKOUT_RESOURCE_URI } },
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
        "Search the exercise catalog by name (substring match on English and Czech names). Returns exercises with body part and equipment info. If this returns no results for what should be a valid exercise, fall back to `find_or_suggest_exercise` which uses an LLM to interpret slang/abbreviations and propose a standardized name.",
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

  server.registerTool(
    "find_or_suggest_exercise",
    {
      title: "Find or Suggest Exercise",
      description:
        "LLM-powered fallback for `search_exercises`. Interprets the user's free-form description (any language, slang, abbreviations) and returns a structured suggestion with standardized OPE naming. Use this when `search_exercises` returns no good match.\n\n" +
        "Returns `{ exercises, suggestion }`:\n" +
        "- `exercises`: any direct DB matches for the query (may be empty).\n" +
        "- `suggestion.isExistingMatch === true`: pick the matching exercise from `exercises` (or call `search_exercises` with `suggestion.exerciseName` to get its id), then use it directly.\n" +
        "- `suggestion.isExistingMatch === false`: the exercise does not exist yet — call `create_exercise` with the suggestion fields to mint it, then use the returned id.\n\n" +
        "The suggestion follows OPE naming: readable name with proper spaces (e.g., `Bench Press`), snake_case slug (e.g., `bench_press`), no equipment in the name (equipment is a separate dimension via `defaultEquipmentSlug` / `sessionEquipmentSlug`).",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            "Free-form description of the exercise (any language). E.g. 'bench press with bands', 'tlak na hrudník na šikmé lavici'.",
          ),
      },
    },
    async ({ query }, extra) => {
      const userId = extractUserId(extra);

      const suggestion = await searchExerciseWithAI(query, userId);

      const directMatches = await prisma.exercise.findMany({
        where: {
          AND: [
            { OR: [{ isPublic: true }, { createdById: userId }] },
            {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { czechName: { contains: query, mode: "insensitive" } },
              ],
            },
          ],
        },
        include: {
          primaryBodyPart: true,
          secondaryBodyParts: true,
          equipment: true,
        },
        take: 5,
      });

      return json({ exercises: directMatches, suggestion });
    },
  );

  server.registerTool(
    "create_exercise",
    {
      title: "Create Exercise",
      description:
        "Create a new exercise in the catalog. Use this AFTER `find_or_suggest_exercise` returns a suggestion with `isExistingMatch === false`, or when you already know an exercise is missing.\n\n" +
        "OPE naming rules (must follow):\n" +
        "- `name`: readable display name with spaces and proper capitalization (e.g., `Bench Press`, `Romanian Deadlift`). NEVER include equipment in the name (no `Dumbbell Curl` — use `Bicep Curl` and set `equipmentSlug: 'dumbbell'`).\n" +
        "- `slug`: snake_case identifier matching the name (e.g., `bench_press`, `romanian_deadlift`). Lowercase letters, digits and underscores only.\n" +
        "- Use anatomical Latin singulars: `Triceps` (not `Tricep`), `Biceps` (not `Bicep`).\n" +
        "- `czechName`: natural Czech translation.\n\n" +
        "Body part slugs: `chest`, `back`, `lats`, `traps`, `shoulders-front`, `shoulders-side`, `shoulders-rear`, `biceps`, `triceps`, `forearms`, `abs`, `obliques`, `lower-back`, `glutes`, `quads`, `hamstrings`, `calves`, `adductors`.\n" +
        "Equipment slugs: `barbell`, `dumbbell`, `cable`, `machine`, `smith-machine`, `bodyweight`, `weighted-bodyweight`, `band`, `kettlebell`, `ez-bar`, `plate`, `trap-bar`, `landmine`, `suspension`, `other`.\n\n" +
        "ALWAYS prefer searching first (`search_exercises`, `find_or_suggest_exercise`) before creating to avoid duplicates.",
      inputSchema: {
        name: z.string().min(1).describe("Readable display name"),
        slug: z
          .string()
          .regex(
            /^[a-z0-9_]+$/,
            "Slug must contain only lowercase letters, numbers, and underscores",
          )
          .optional()
          .describe(
            "snake_case OPE identifier. If omitted, an auto-generated private slug is used.",
          ),
        czechName: z.string().optional().describe("Czech translation"),
        primaryBodyPartSlug: z
          .string()
          .optional()
          .describe("Slug of the primary body part"),
        secondaryBodyPartSlugs: z
          .array(z.string())
          .optional()
          .describe("Slugs of secondary body parts"),
        equipmentSlug: z
          .string()
          .optional()
          .describe("Default equipment slug for this movement"),
        isPublic: z
          .boolean()
          .optional()
          .describe(
            "Whether the exercise is public (default true). Set to false to keep it private to the current user.",
          ),
      },
    },
    async (
      {
        name,
        slug,
        czechName,
        primaryBodyPartSlug,
        secondaryBodyPartSlugs,
        equipmentSlug,
        isPublic,
      },
      extra,
    ) => {
      const userId = extractUserId(extra);

      const finalSlug = slug ?? generateExerciseSlug(name, userId);

      const primaryBodyPart = primaryBodyPartSlug
        ? await prisma.bodyPart.findUnique({
            where: { slug: primaryBodyPartSlug },
          })
        : null;
      if (primaryBodyPartSlug && !primaryBodyPart) {
        return error(`Unknown primaryBodyPartSlug: ${primaryBodyPartSlug}`);
      }

      const secondaryBodyParts =
        secondaryBodyPartSlugs && secondaryBodyPartSlugs.length > 0
          ? await prisma.bodyPart.findMany({
              where: { slug: { in: secondaryBodyPartSlugs } },
            })
          : [];

      const equipment = equipmentSlug
        ? await prisma.equipment.findUnique({ where: { slug: equipmentSlug } })
        : null;
      if (equipmentSlug && !equipment) {
        return error(`Unknown equipmentSlug: ${equipmentSlug}`);
      }

      try {
        const exercise = await prisma.exercise.create({
          data: {
            name,
            slug: finalSlug,
            czechName,
            isPublic: isPublic ?? true,
            createdById: userId,
            primaryBodyPartId: primaryBodyPart?.id,
            equipmentId: equipment?.id,
            secondaryBodyParts: {
              connect: secondaryBodyParts.map((bp) => ({ id: bp.id })),
            },
          },
          include: {
            primaryBodyPart: true,
            secondaryBodyParts: true,
            equipment: true,
          },
        });

        return json(exercise);
      } catch (e) {
        if (
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          e.code === "P2002"
        ) {
          return error(
            `An exercise with slug "${finalSlug}" already exists. Use search_exercises to find it.`,
          );
        }
        throw e;
      }
    },
  );

  server.registerTool(
    "list_places",
    {
      title: "List Places",
      description:
        "List the user's gyms/places. Use to resolve a place name to an ID for filtering workouts.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const userId = extractUserId(extra);
      const places = await getPlaces(userId);
      return json(places.map((p) => ({ id: p.id, name: p.name })));
    },
  );

  server.registerTool(
    "generate_workout_title",
    {
      title: "Generate Workout Title",
      description:
        "Generate a title for a workout from its first three exercises. Returns the title without modifying the workout; use update_workout to persist it.",
      inputSchema: {
        workoutId: z.string().describe("The workout ID"),
      },
    },
    async ({ workoutId }, extra) => {
      const userId = extractUserId(extra);
      const workout = await getWorkout(userId, workoutId);
      if (!workout) return error("Workout not found");
      const title = generateWorkoutTitle(
        workout.exercises.map((e) => e.exercise.name),
      );
      return json({ workoutId, title });
    },
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  registerAppTool(
    server,
    "create_workout",
    {
      title: "Create Workout",
      description:
        "Start a new workout, or log a completed one. Optionally create from a template or at a specific place. Opens an interactive editor UI.\n\n" +
        "TIME HANDLING — IMPORTANT:\n" +
        "- If the user did NOT mention when the workout started, ask them before calling this tool (e.g. 'When did you start? (now / a time today / a past date)').\n" +
        "- If the user is logging a workout that has already finished and did not mention the end time, also ask for it.\n" +
        "- Omit `startedAt` only if the user explicitly says the workout starts now. Omit `endedAt` for an in-progress workout.\n" +
        "- Always pass times as ISO 8601 strings.",
      inputSchema: {
        name: z.string().max(100).optional().describe("Workout name"),
        templateId: z
          .string()
          .optional()
          .describe("Template ID to copy exercises from"),
        placeId: z.string().optional().describe("Place/gym ID"),
        notes: z.string().max(500).optional().describe("Workout notes"),
        startedAt: z
          .string()
          .datetime()
          .optional()
          .describe(
            "ISO 8601 start time (e.g. '2026-05-06T18:00:00Z'). If the user did not mention when the workout started, ASK them before calling this tool. Only omit if the user explicitly says they're starting now.",
          ),
        endedAt: z
          .string()
          .datetime()
          .optional()
          .describe(
            "ISO 8601 end time. Only set when logging a workout that has already finished. If the user is logging a past/completed workout but did not mention an end time, ASK them. Omit when starting a new in-progress workout.",
          ),
      },
      _meta: { ui: { resourceUri: WORKOUT_RESOURCE_URI } },
    },
    async ({ name, templateId, placeId, notes, startedAt, endedAt }, extra) => {
      const userId = extractUserId(extra);

      if (placeId && !(await verifyPlaceAccess(placeId, userId))) {
        return error("Invalid place ID");
      }

      let exercisesToCreate: {
        exerciseId: string;
        equipmentId?: string | null;
        order: number;
      }[] = [];
      let exerciseNames: string[] = [];
      let workoutName = name;

      if (templateId) {
        const template = await prisma.workoutTemplate.findFirst({
          where: { id: templateId, userId },
          include: {
            items: {
              orderBy: { order: "asc" },
              include: {
                exercise: { select: { equipmentId: true, name: true } },
              },
            },
          },
        });

        if (template) {
          exercisesToCreate = template.items.map((item) => ({
            exerciseId: item.exerciseId,
            equipmentId: item.equipmentId ?? item.exercise.equipmentId,
            order: item.order,
          }));
          exerciseNames = template.items.map((item) => item.exercise.name);
          if (!workoutName) {
            workoutName = generateWorkoutTitle(exerciseNames) || template.name;
          }
        }
      }

      const workout = await prisma.workout.create({
        data: {
          userId,
          name: workoutName,
          placeId,
          notes,
          ...(startedAt && { startedAt: new Date(startedAt) }),
          ...(endedAt && { endedAt: new Date(endedAt) }),
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
      description:
        "Mark a workout as complete by setting endedAt to now. If the workout has no name, generate one from its first three exercises.",
      inputSchema: {
        workoutId: z.string().describe("The workout ID"),
      },
    },
    async ({ workoutId }, extra) => {
      const userId = extractUserId(extra);
      const existing = await prisma.workout.findFirst({
        where: { id: workoutId, userId },
        select: {
          name: true,
          exercises: {
            orderBy: { order: "asc" },
            select: { exercise: { select: { name: true } } },
          },
        },
      });
      if (!existing) return error("Workout not found");

      const data: { endedAt: Date; name?: string } = { endedAt: new Date() };
      if (!existing.name && existing.exercises.length > 0) {
        const generated = generateWorkoutTitle(
          existing.exercises.map((e) => e.exercise.name),
        );
        if (generated) data.name = generated;
      }

      const workout = await prisma.workout.update({
        where: { id: workoutId },
        data,
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

  // ── Templates ──────────────────────────────────────────────────────────────

  registerAppTool(
    server,
    "create_workout_template",
    {
      title: "Create Workout Template",
      description:
        "Create a reusable workout template (a named list of exercises that can later seed a workout via `create_workout`'s `templateId`). Opens an interactive editor UI where the user can fine-tune the template. Items are optional — if omitted, the template is created empty and the user adds exercises in the UI.",
      inputSchema: {
        name: z.string().min(1).max(100).describe("Template name"),
        items: z
          .array(
            z.object({
              exerciseId: z
                .string()
                .describe("Exercise ID (from search_exercises)"),
              equipmentId: z
                .string()
                .nullable()
                .optional()
                .describe(
                  "Equipment override ID. Omit/null to use the exercise's default equipment.",
                ),
              order: z
                .number()
                .int()
                .min(0)
                .describe("Position in the template, 0-indexed"),
            }),
          )
          .optional()
          .describe(
            "Initial exercises in the template, in order. Optional; can be added later through the UI.",
          ),
      },
      _meta: { ui: { resourceUri: TEMPLATE_RESOURCE_URI } },
    },
    async ({ name, items }, extra) => {
      const userId = extractUserId(extra);

      if (items) {
        for (const item of items) {
          if (!(await verifyExerciseAccess(item.exerciseId, userId))) {
            return error(`Invalid exerciseId: ${item.exerciseId}`);
          }
          if (
            item.equipmentId &&
            !(await verifyEquipmentAccess(item.equipmentId, userId))
          ) {
            return error(`Invalid equipmentId: ${item.equipmentId}`);
          }
        }
      }

      const template = await prisma.workoutTemplate.create({
        data: {
          userId,
          name,
          items: items
            ? {
                create: items.map((item) => ({
                  exerciseId: item.exerciseId,
                  equipmentId: item.equipmentId ?? null,
                  order: item.order,
                })),
              }
            : undefined,
        },
        include: templateFullInclude,
      });

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(template, null, 2) },
        ],
        structuredContent: template as unknown as Record<string, unknown>,
      };
    },
  );

  registerAppTool(
    server,
    "get_workout_template",
    {
      title: "Get Workout Template",
      description:
        "Get full details of a workout template including all exercises and equipment overrides. Opens an interactive editor UI.",
      inputSchema: {
        templateId: z.string().describe("The workout template ID"),
      },
      _meta: { ui: { resourceUri: TEMPLATE_RESOURCE_URI } },
    },
    async ({ templateId }, extra) => {
      const userId = extractUserId(extra);
      const template = await getTemplate(userId, templateId);
      if (!template) return error("Template not found");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(template, null, 2) },
        ],
        structuredContent: template as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "update_workout_template",
    {
      title: "Update Workout Template",
      description:
        "Rename a template and/or replace its exercise list. When `items` is provided, ALL existing items are replaced — pass the full new list with explicit `order` values. Use this single tool for renaming, adding, removing, and reordering.",
      inputSchema: {
        templateId: z.string().describe("The template ID"),
        name: z.string().min(1).max(100).optional().describe("New name"),
        items: z
          .array(
            z.object({
              exerciseId: z.string(),
              equipmentId: z.string().nullable().optional(),
              order: z.number().int().min(0),
            }),
          )
          .optional()
          .describe(
            "Full replacement list of items, in order. Omit to leave items unchanged.",
          ),
      },
    },
    async ({ templateId, name, items }, extra) => {
      const userId = extractUserId(extra);
      if (!(await findOwnedTemplate(templateId, userId)))
        return error("Template not found");

      if (items) {
        for (const item of items) {
          if (!(await verifyExerciseAccess(item.exerciseId, userId))) {
            return error(`Invalid exerciseId: ${item.exerciseId}`);
          }
          if (
            item.equipmentId &&
            !(await verifyEquipmentAccess(item.equipmentId, userId))
          ) {
            return error(`Invalid equipmentId: ${item.equipmentId}`);
          }
        }
      }

      const template = await prisma.$transaction(async (tx) => {
        if (items) {
          await tx.workoutTemplateItem.deleteMany({
            where: { templateId },
          });
          if (items.length > 0) {
            await tx.workoutTemplateItem.createMany({
              data: items.map((item) => ({
                templateId,
                exerciseId: item.exerciseId,
                equipmentId: item.equipmentId ?? null,
                order: item.order,
              })),
            });
          }
        }

        return tx.workoutTemplate.update({
          where: { id: templateId },
          data: { ...(name !== undefined && { name }) },
          include: templateFullInclude,
        });
      });

      return json(template);
    },
  );
}
