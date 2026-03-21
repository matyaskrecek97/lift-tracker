import { Output, stepCountIs, ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import { prisma } from "./prisma";

// Structured output schema matching the solution draft
const exerciseSuggestionSchema = z.object({
  isExistingMatch: z.boolean().describe("True if matched to existing entry"),
  exerciseName: z
    .string()
    .describe("Readable exercise name for display (e.g., 'Bench Press')"),
  exerciseSlug: z
    .string()
    .describe("OPE standardized slug identifier (e.g., 'bench_press')"),
  czechName: z.string().describe("Czech translation of the exercise name"),
  primaryBodyPartSlug: z
    .string()
    .describe("Slug of the primary body part (e.g., 'chest', 'back')"),
  secondaryBodyPartSlugs: z
    .array(z.string())
    .describe("Array of secondary body part slugs"),
  defaultEquipmentSlug: z
    .string()
    .nullable()
    .describe("Typical equipment for this exercise"),
  sessionEquipmentSlug: z
    .string()
    .nullable()
    .describe("Equipment override for this session if different from default"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence level of the suggestion"),
});

export type ExerciseSuggestion = z.infer<typeof exerciseSuggestionSchema>;

// Parameters schema for the search tool
const searchExercisesParamsSchema = z.object({
  namePattern: z
    .string()
    .optional()
    .describe(
      "Pattern to search in exercise names (case-insensitive, partial match)",
    ),
  bodyPartSlug: z
    .string()
    .optional()
    .describe("Body part slug to filter by (e.g., 'chest', 'shoulders-front')"),
  equipmentSlug: z
    .string()
    .optional()
    .describe("Equipment slug to filter by (e.g., 'barbell', 'dumbbell')"),
});

type SearchExercisesParams = z.infer<typeof searchExercisesParamsSchema>;

async function searchExercisesExecute(
  params: SearchExercisesParams,
  userId?: string,
): Promise<
  {
    id: string;
    name: string;
    slug: string;
    czechName: string | null;
    primaryBodyPart: {
      slug: string;
      name: string;
      czechName: string | null;
    } | null;
    secondaryBodyParts: {
      slug: string;
      name: string;
      czechName: string | null;
    }[];
    equipment: { slug: string; name: string; czechName: string | null } | null;
  }[]
> {
  const { namePattern, bodyPartSlug, equipmentSlug } = params;

  // Visibility: public exercises + user's private exercises (if userId provided)
  const visibilityFilter = userId
    ? { OR: [{ isPublic: true }, { createdById: userId }] }
    : { isPublic: true };

  const andConditions: Record<string, unknown>[] = [visibilityFilter];

  if (namePattern) {
    andConditions.push({
      OR: [
        { name: { contains: namePattern, mode: "insensitive" } },
        { czechName: { contains: namePattern, mode: "insensitive" } },
      ],
    });
  }

  if (bodyPartSlug) {
    andConditions.push({ primaryBodyPart: { slug: bodyPartSlug } });
  }

  if (equipmentSlug) {
    andConditions.push({ equipment: { slug: equipmentSlug } });
  }

  const exercises = await prisma.exercise.findMany({
    where: { AND: andConditions },
    take: 20,
    include: {
      primaryBodyPart: true,
      secondaryBodyParts: true,
      equipment: true,
    },
  });

  return exercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    slug: ex.slug,
    czechName: ex.czechName,
    primaryBodyPart: ex.primaryBodyPart
      ? {
          slug: ex.primaryBodyPart.slug,
          name: ex.primaryBodyPart.name,
          czechName: ex.primaryBodyPart.czechName,
        }
      : null,
    secondaryBodyParts: ex.secondaryBodyParts.map((bp) => ({
      slug: bp.slug,
      name: bp.name,
      czechName: bp.czechName,
    })),
    equipment: ex.equipment
      ? {
          slug: ex.equipment.slug,
          name: ex.equipment.name,
          czechName: ex.equipment.czechName,
        }
      : null,
  }));
}

const AGENT_INSTRUCTIONS = `You are an exercise search and normalization agent for a workout tracking app.

Your job:
1. Interpret user input in ANY language (Czech, English, slang, abbreviations, etc.)
2. Search the exercise catalog for existing matches (both public and user's private exercises)
3. If a match exists, return it
4. If no match exists, generate a standardized OPE (Open Powerlifting Exercise) name and slug

CRITICAL RULES:
- **Always prefer an existing exercise over creating a new one.** Search thoroughly (by name, body part, partial terms) before concluding no match exists. A new exercise should be a last resort.
- **Equipment is a separate dimension from exercise identity.** The movement pattern defines the exercise, not the equipment used.
- NEVER include equipment in the exercise name (e.g., "Dumbbell Curl" or "Cable Row" is WRONG — use "Bicep Curl" or "Seated Row" with the equipment set separately).
- If user mentions specific equipment (e.g., "bench press with bands"), return:
  - exerciseName: "Bench Press" (the movement)
  - defaultEquipmentSlug: "barbell" (typical equipment)
  - sessionEquipmentSlug: "band" (what user specified for this session)

DUPLICATE PREVENTION:
- Before creating a new exercise, search by body part slug to see ALL exercises for that muscle group. The exercise may already exist under a different name.
- Treat spelling variants as the SAME exercise (e.g., "triceps" = "tricep", "biceps" = "bicep"). Always match to the existing spelling in the catalog rather than creating a duplicate.
- If the user's input is a generic description of an existing exercise (e.g., "curl" when "Bicep Curl" exists, or "press" when "Bench Press" exists), match to the existing exercise.

NAMING CONVENTION:
- exerciseName: Readable display name with spaces and proper capitalization (e.g., "Bench Press", "Romanian Deadlift")
- exerciseSlug: OPE standardized identifier with underscores, all lowercase (e.g., "bench_press", "romanian_deadlift")
- Use anatomically correct terms: "Triceps" (not "Tricep"), "Biceps" (not "Bicep") — these are singular Latin forms
- Be specific but concise: "Incline Bench Press" / "incline_bench_press"
- Examples:
  - exerciseName: "Bulgarian Split Squat", exerciseSlug: "bulgarian_split_squat"
  - exerciseName: "Face Pull", exerciseSlug: "face_pull"

BODY PARTS (use these slugs):
- chest, back, lats, traps
- shoulders-front, shoulders-side, shoulders-rear
- biceps, triceps, forearms
- abs, obliques, lower-back
- glutes, quads, hamstrings, calves, adductors

EQUIPMENT (use these slugs):
- barbell, dumbbell, cable, machine, smith-machine
- bodyweight, weighted-bodyweight
- band, kettlebell, ez-bar, plate, trap-bar
- landmine, suspension, other

PROCESS:
1. Understand what movement the user is describing
2. Search broadly: try the name pattern first, then search by body part slug as a fallback
3. If a search returns exercises, check carefully for semantic matches — don't require an exact name match
4. If match found: return it with isExistingMatch: true
5. If no match after at least 2 search attempts: create a standardized name following OPE convention
6. Generate Czech translation that sounds natural
7. Always return a suggestion - never say you can't find anything

Be confident but reasonable with your suggestions. If you're unsure, set confidence to "medium" or "low".`;

function createExerciseSearchAgent(userId?: string) {
  return new ToolLoopAgent({
    model: "google/gemini-2.5-flash",
    instructions: AGENT_INSTRUCTIONS,
    tools: {
      searchExercises: tool({
        description:
          "Search the exercise catalog by name pattern, body part slug, and/or equipment slug. Returns up to 20 exercises (public + user's private) with their details.",
        inputSchema: searchExercisesParamsSchema,
        execute: (params) => searchExercisesExecute(params, userId),
      }),
    },
    output: Output.object({
      schema: exerciseSuggestionSchema,
    }),
    stopWhen: stepCountIs(5),
  });
}

/** Step-level debug info for verbose mode */
export interface AgentStepDebugInfo {
  stepNumber: number;
  toolCalls: { toolName: string; input: unknown }[];
  toolResults: { toolName: string; output: unknown }[];
  text: string;
  finishReason: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

/** Full result returned in verbose mode */
export interface ExerciseSearchDebugResult {
  suggestion: ExerciseSuggestion;
  steps: AgentStepDebugInfo[];
  totalUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/** Error with attached debug info, thrown when the agent fails */
export interface AgentError extends Error {
  debugResult?: Omit<ExerciseSearchDebugResult, "suggestion">;
}

/**
 * Run the exercise search agent to find or suggest an exercise.
 *
 * @param userQuery The user's search query in any language
 * @param userId Optional user ID to include user's private exercises in search
 * @param options.verbose When true, returns full debug info (steps, tool calls, token usage)
 */
export async function searchExerciseWithAI(
  userQuery: string,
  userId?: string,
  options?: { verbose?: boolean },
): Promise<ExerciseSuggestion | ExerciseSearchDebugResult> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is not configured");
  }

  // Collect steps incrementally so we have diagnostics even if the SDK throws
  const collectedSteps: AgentStepDebugInfo[] = [];

  function collectStep(step: {
    toolCalls: { toolName: string; input: unknown }[];
    toolResults: { toolName: string; output: unknown }[];
    text: string;
    finishReason: string;
    usage: { inputTokens?: number; outputTokens?: number };
  }) {
    collectedSteps.push({
      stepNumber: collectedSteps.length + 1,
      toolCalls: step.toolCalls.map((tc) => ({
        toolName: tc.toolName,
        input: tc.input,
      })),
      toolResults: step.toolResults.map((tr) => ({
        toolName: tr.toolName,
        output: tr.output,
      })),
      text: step.text,
      finishReason: step.finishReason,
      usage: {
        inputTokens: step.usage.inputTokens ?? 0,
        outputTokens: step.usage.outputTokens ?? 0,
        totalTokens:
          (step.usage.inputTokens ?? 0) + (step.usage.outputTokens ?? 0),
      },
    });
  }

  function buildTotalUsage() {
    return collectedSteps.reduce(
      (acc, s) => ({
        inputTokens: acc.inputTokens + s.usage.inputTokens,
        outputTokens: acc.outputTokens + s.usage.outputTokens,
        totalTokens: acc.totalTokens + s.usage.totalTokens,
      }),
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    );
  }

  const agent = createExerciseSearchAgent(userId);

  let result: Awaited<ReturnType<typeof agent.generate>> | undefined;
  try {
    result = await agent.generate({
      prompt: userQuery,
      onStepFinish: collectStep,
    });
  } catch (cause) {
    const error = new Error(
      cause instanceof Error ? cause.message : String(cause),
      { cause },
    );
    (error as AgentError).debugResult = {
      steps: collectedSteps,
      totalUsage: buildTotalUsage(),
    };
    throw error;
  }

  if (!result.output) {
    const error = new Error("Agent did not return structured output");
    (error as AgentError).debugResult = {
      steps: collectedSteps,
      totalUsage: buildTotalUsage(),
    };
    throw error;
  }

  if (!options?.verbose) {
    return result.output;
  }

  return {
    suggestion: result.output,
    steps: collectedSteps,
    totalUsage: buildTotalUsage(),
  };
}
