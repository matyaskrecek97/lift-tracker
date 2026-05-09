export interface BodyPart {
  id: string;
  name: string;
  czechName: string | null;
  slug: string;
}

export interface Equipment {
  id: string;
  name: string;
  czechName: string | null;
  slug: string;
  isPublic: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  czechName: string | null;
  isPublic: boolean;
  primaryBodyPart: BodyPart | null;
  secondaryBodyParts: BodyPart[];
  equipment: Equipment | null;
}

export interface WorkoutSet {
  id: string;
  order: number;
  reps: number;
  weightKg: number | string;
  isWarmup: boolean;
}

export interface WorkoutExercise {
  id: string;
  order: number;
  notes: string | null;
  exercise: Exercise;
  equipment: Equipment | null;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  name: string | null;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  isArchived: boolean;
  place: { id: string; name: string } | null;
  exercises: WorkoutExercise[];
}

export interface WorkoutTemplateItem {
  id: string;
  order: number;
  exercise: Exercise;
  equipment: Equipment | null;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  items: WorkoutTemplateItem[];
}

export interface ExerciseSuggestion {
  isExistingMatch: boolean;
  exerciseName: string;
  exerciseSlug: string;
  czechName: string;
  primaryBodyPartSlug: string;
  secondaryBodyPartSlugs: string[];
  defaultEquipmentSlug: string | null;
  sessionEquipmentSlug: string | null;
  confidence: "high" | "medium" | "low";
}

export interface FindOrSuggestExerciseResult {
  exercises: Exercise[];
  suggestion: ExerciseSuggestion;
}
