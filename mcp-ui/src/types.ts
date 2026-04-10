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
