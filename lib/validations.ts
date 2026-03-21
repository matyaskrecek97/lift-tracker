import { z } from "zod";

// =============================================================================
// Places
// =============================================================================

export const createPlaceSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updatePlaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isArchived: z.boolean().optional(),
});

// =============================================================================
// Templates
// =============================================================================

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  items: z
    .array(
      z.object({
        exerciseId: z.string(),
        equipmentId: z.string().optional().nullable(),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  items: z
    .array(
      z.object({
        exerciseId: z.string(),
        equipmentId: z.string().optional().nullable(),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
});

export const createTemplateFromWorkoutSchema = z.object({
  name: z.string().max(100).optional(),
});

// =============================================================================
// Workouts
// =============================================================================

export const createWorkoutSchema = z.object({
  templateId: z.string().optional(),
  placeId: z.string().optional(),
  name: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const updateWorkoutSchema = z.object({
  name: z.string().max(100).nullable().optional(),
  placeId: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  startedAt: z.coerce.date().optional(),
  endedAt: z.coerce.date().nullable().optional(),
});

// =============================================================================
// Workout Exercises
// =============================================================================

export const addWorkoutExerciseSchema = z.object({
  exerciseId: z.string(),
  equipmentId: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export const updateWorkoutExerciseSchema = z.object({
  order: z.number().int().min(0).optional(),
  notes: z.string().max(500).nullable().optional(),
  equipmentId: z.string().nullable().optional(),
  exerciseId: z.string().optional(),
});

// =============================================================================
// Workout Sets
// =============================================================================

export const addSetSchema = z.object({
  reps: z.number().int().min(1).max(999),
  weightKg: z.number().min(0).max(9999.99),
  isWarmup: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

export const updateSetSchema = z.object({
  reps: z.number().int().min(1).max(999).optional(),
  weightKg: z.number().min(0).max(9999.99).optional(),
  isWarmup: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

// =============================================================================
// Exercises
// =============================================================================

export const createExerciseSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9_]+$/,
      "Slug must contain only lowercase letters, numbers, and underscores",
    )
    .optional(),
  czechName: z.string().optional(),
  primaryBodyPartSlug: z.string().optional(),
  secondaryBodyPartSlugs: z.array(z.string()).optional(),
  equipmentSlug: z.string().optional(),
  isPublic: z.boolean(),
});

export const updateExerciseSchema = z.object({
  name: z.string().optional(),
  czechName: z.string().optional(),
  primaryBodyPartSlug: z.string().optional(),
  secondaryBodyPartSlugs: z.array(z.string()).optional(),
  equipmentSlug: z.string().optional(),
});

export const exerciseAISearchSchema = z.object({
  query: z.string().min(1),
  useLLM: z.boolean().optional().default(false),
});

// =============================================================================
// Equipment
// =============================================================================

export const createEquipmentSchema = z.object({
  name: z.string().min(1),
  czechName: z.string().optional(),
});

export const updateEquipmentSchema = z.object({
  name: z.string().optional(),
  czechName: z.string().optional(),
});

// =============================================================================
// Exercise History
// =============================================================================

export const exerciseHistorySchema = z.object({
  exerciseIds: z.array(z.string()).min(1).max(50),
  excludeWorkoutId: z.string().optional(),
  equipmentByExercise: z.record(z.string(), z.string().nullable()).optional(),
});

export const exerciseSearchSchema = z.object({
  q: z.string().optional(),
  bodyPartSlug: z.string().optional(),
  bodyPartSlugs: z.string().optional(),
  equipmentSlug: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
