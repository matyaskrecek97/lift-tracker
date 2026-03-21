import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  });

async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// Shared debounce hooks
// ---------------------------------------------------------------------------

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// biome-ignore lint/suspicious/noExplicitAny: generic callback wrapper
type AnyFunction = (...args: any[]) => any;

export function useDebouncedCallback<T extends AnyFunction>(
  callback: T,
  delay = 500,
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: forwarding arbitrary args
    (...args: any[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(
        () => callbackRef.current(...args),
        delay,
      );
    },
    [delay],
  ) as unknown as T;
}

// Types for API responses
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

export interface Place {
  id: string;
  name: string;
  isArchived: boolean;
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
  equipment: Equipment | null; // Override equipment for this session
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  name: string | null;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  isArchived: boolean;
  place: Place | null;
  exercises: WorkoutExercise[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  items: {
    id: string;
    order: number;
    exercise: Exercise;
    equipment: Equipment | null; // Override equipment for template
  }[];
}

export interface ExerciseUsed {
  id: string;
  name: string;
  czechName: string | null;
}

export interface VolumeHistoryItem {
  date: string;
  volume: number;
}

export interface AvgE1rmHistoryItem {
  date: string;
  avgE1rm: number;
}

export interface Stats {
  totalWorkouts: number;
  totalVolume: number;
  totalSets: number;
  streak: number;
  prsInRange: number;
  volumeHistory: VolumeHistoryItem[];
  avgE1rmHistory: AvgE1rmHistoryItem[];
  exercisesUsed: ExerciseUsed[];
  dateRange: {
    start: string;
    end: string;
  };
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Hooks
export function useExercises(
  query?: string,
  includePrivate = true,
  bodyPartSlugs?: string[],
) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (includePrivate) params.set("includePrivate", "true");
  if (bodyPartSlugs && bodyPartSlugs.length > 0)
    params.set("bodyPartSlugs", bodyPartSlugs.join(","));
  const queryString = params.toString();
  return useSWR<Exercise[]>(
    queryString ? `/api/exercises?${queryString}` : "/api/exercises",
    fetcher,
    { keepPreviousData: true },
  );
}

export function useEquipment() {
  return useSWR<Equipment[]>("/api/equipment", fetcher);
}

export function useBodyParts() {
  return useSWR<BodyPart[]>("/api/body-parts", fetcher);
}

export function usePlaces() {
  return useSWR<Place[]>("/api/places", fetcher);
}

export function useTemplates() {
  return useSWR<WorkoutTemplate[]>("/api/templates", fetcher);
}

export function useTemplate(
  id: string | null,
  options?: { fallbackData?: WorkoutTemplate },
) {
  return useSWR<WorkoutTemplate>(id ? `/api/templates/${id}` : null, fetcher, {
    refreshInterval: 0,
    ...options,
  });
}

export function useWorkouts(limit = 20) {
  return useSWR<Workout[]>(`/api/workouts?limit=${limit}`, fetcher);
}

export function useWorkout(
  id: string | null,
  options?: { fallbackData?: Workout },
) {
  return useSWR<Workout>(id ? `/api/workouts/${id}` : null, fetcher, {
    refreshInterval: 0,
    ...options,
  });
}

export function useStats(
  dateRange?: DateRange,
  options?: { fallbackData?: Stats },
) {
  const params = new URLSearchParams();
  if (dateRange) {
    params.set("startDate", dateRange.startDate.toISOString());
    params.set("endDate", dateRange.endDate.toISOString());
  }
  const queryString = params.toString();
  const url = queryString ? `/api/stats?${queryString}` : "/api/stats";
  return useSWR<Stats>(url, fetcher, options);
}

export function useExerciseHistory(
  exerciseIds: string[],
  workoutId: string,
  equipmentByExercise?: Record<string, string | null>,
) {
  const equipmentHash = equipmentByExercise
    ? JSON.stringify(equipmentByExercise)
    : "";
  const key =
    exerciseIds.length > 0
      ? ["/api/exercises/history", ...exerciseIds.sort(), workoutId, equipmentHash]
      : null;
  return useSWR<Record<string, { reps: number; weight: number } | null>>(
    key,
    () =>
      fetch("/api/exercises/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseIds,
          excludeWorkoutId: workoutId,
          equipmentByExercise,
        }),
      }).then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      }),
  );
}

export function useExerciseStats(exerciseId: string | null) {
  return useSWR(
    exerciseId ? `/api/stats/exercise/${exerciseId}` : null,
    fetcher,
  );
}

// Invalidate all /api/workouts list cache keys (different pages use different limits)
function mutateWorkoutList() {
  mutate(
    (key: string) =>
      typeof key === "string" && key.startsWith("/api/workouts?"),
    undefined,
    { revalidate: true },
  );
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

const jsonHeaders = { "Content-Type": "application/json" };

function mutateExercises() {
  mutate(
    (key: string) =>
      typeof key === "string" && key.startsWith("/api/exercises"),
    undefined,
    { revalidate: true },
  );
}

export async function createWorkout(data: {
  templateId?: string;
  placeId?: string;
  name?: string;
  notes?: string;
}): Promise<Workout> {
  const workout = await apiFetch<Workout>("/api/workouts", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
  mutateWorkoutList();
  return workout;
}

export async function updateWorkout(
  id: string,
  data: {
    name?: string | null;
    placeId?: string | null;
    notes?: string | null;
    startedAt?: Date;
    endedAt?: Date | null;
  },
): Promise<Workout> {
  const workout = await apiFetch<Workout>(`/api/workouts/${id}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
  mutate(`/api/workouts/${id}`);
  mutateWorkoutList();
  return workout;
}

export async function deleteWorkout(id: string) {
  await apiFetch(`/api/workouts/${id}`, { method: "DELETE" });
  mutateWorkoutList();
}

export async function duplicateWorkout(id: string): Promise<Workout> {
  const workout = await apiFetch<Workout>(`/api/workouts/${id}/duplicate`, {
    method: "POST",
  });
  mutateWorkoutList();
  return workout;
}

export async function createTemplateFromWorkout(
  id: string,
  name?: string,
): Promise<WorkoutTemplate> {
  const template = await apiFetch<WorkoutTemplate>(
    `/api/workouts/${id}/create-template`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(name ? { name } : {}),
    },
  );
  mutate("/api/templates");
  return template;
}

export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  equipmentId?: string | null,
) {
  const exercise = await apiFetch<WorkoutExercise>(
    `/api/workouts/${workoutId}/exercises`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ exerciseId, equipmentId }),
    },
  );
  mutate(`/api/workouts/${workoutId}`);
  return exercise;
}

export async function removeExerciseFromWorkout(
  workoutId: string,
  exerciseId: string,
) {
  await apiFetch(`/api/workouts/${workoutId}/exercises/${exerciseId}`, {
    method: "DELETE",
  });
  mutate(`/api/workouts/${workoutId}`);
}

export async function updateWorkoutExercise(
  workoutId: string,
  exerciseId: string,
  data: {
    order?: number;
    notes?: string | null;
    equipmentId?: string | null;
    exerciseId?: string;
  },
) {
  const exercise = await apiFetch<WorkoutExercise>(
    `/api/workouts/${workoutId}/exercises/${exerciseId}`,
    {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    },
  );
  mutate(`/api/workouts/${workoutId}`);
  return exercise;
}

export async function addSet(
  workoutId: string,
  exerciseId: string,
  data: { reps: number; weightKg: number; isWarmup?: boolean },
) {
  const set = await apiFetch<WorkoutSet>(
    `/api/workouts/${workoutId}/exercises/${exerciseId}/sets`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    },
  );
  mutate(`/api/workouts/${workoutId}`);
  return set;
}

export async function updateSet(
  workoutId: string,
  exerciseId: string,
  setId: string,
  data: { reps?: number; weightKg?: number; isWarmup?: boolean },
) {
  const set = await apiFetch<WorkoutSet>(
    `/api/workouts/${workoutId}/exercises/${exerciseId}/sets/${setId}`,
    {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    },
  );
  mutate(`/api/workouts/${workoutId}`);
  return set;
}

export async function deleteSet(
  workoutId: string,
  exerciseId: string,
  setId: string,
) {
  await apiFetch(
    `/api/workouts/${workoutId}/exercises/${exerciseId}/sets/${setId}`,
    { method: "DELETE" },
  );
  mutate(`/api/workouts/${workoutId}`);
}

export async function createExercise(data: {
  name: string;
  slug?: string;
  czechName?: string;
  primaryBodyPartSlug?: string;
  secondaryBodyPartSlugs?: string[];
  equipmentSlug?: string;
  isPublic: boolean;
}) {
  const exercise = await apiFetch<Exercise>("/api/exercises", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
  mutateExercises();
  return exercise;
}

export async function updateExercise(
  id: string,
  data: {
    name?: string;
    czechName?: string;
    primaryBodyPartSlug?: string;
    secondaryBodyPartSlugs?: string[];
    equipmentSlug?: string;
  },
) {
  const exercise = await apiFetch<Exercise>(`/api/exercises/${id}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
  mutateExercises();
  return exercise;
}

export async function deleteExercise(id: string) {
  await apiFetch(`/api/exercises/${id}`, { method: "DELETE" });
  mutateExercises();
}

export async function createEquipment(data: {
  name: string;
  czechName?: string;
}) {
  const equipment = await apiFetch<Equipment>("/api/equipment", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
  mutate("/api/equipment");
  return equipment;
}

export async function updateEquipment(
  id: string,
  data: { name?: string; czechName?: string },
) {
  const equipment = await apiFetch<Equipment>(`/api/equipment/${id}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
  mutate("/api/equipment");
  return equipment;
}

export async function deleteEquipment(id: string) {
  await apiFetch(`/api/equipment/${id}`, { method: "DELETE" });
  mutate("/api/equipment");
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

export interface AISearchResult {
  exercises: Exercise[];
  suggestion: ExerciseSuggestion | null;
}

export async function searchExerciseWithAI(
  query: string,
): Promise<AISearchResult> {
  return apiFetch<AISearchResult>("/api/exercises/search", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ query, useLLM: true }),
  });
}

export async function createPlace(name: string) {
  const place = await apiFetch<Place>("/api/places", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ name }),
  });
  mutate("/api/places");
  return place;
}

export async function updatePlace(id: string, data: { name?: string }) {
  const place = await apiFetch<Place>(`/api/places/${id}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
  mutate("/api/places");
  return place;
}

export async function deletePlace(id: string) {
  await apiFetch(`/api/places/${id}`, { method: "DELETE" });
  mutate("/api/places");
}

export async function seedExampleTemplates() {
  const templates = await apiFetch<WorkoutTemplate[]>(
    "/api/templates/seed-examples",
    { method: "POST" },
  );
  mutate("/api/templates");
  return templates;
}

export async function createTemplate(data: {
  name: string;
  items?: { exerciseId: string; equipmentId?: string | null; order: number }[];
}) {
  const template = await apiFetch<WorkoutTemplate>("/api/templates", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
  mutate("/api/templates");
  return template;
}

export async function updateTemplate(
  id: string,
  data: {
    name?: string;
    items?: {
      exerciseId: string;
      equipmentId?: string | null;
      order: number;
    }[];
  },
) {
  const template = await apiFetch<WorkoutTemplate>(`/api/templates/${id}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
  mutate(`/api/templates/${id}`);
  mutate("/api/templates");
  return template;
}

export async function deleteTemplate(id: string) {
  await apiFetch(`/api/templates/${id}`, { method: "DELETE" });
  mutate("/api/templates");
}

export async function duplicateTemplate(id: string): Promise<WorkoutTemplate> {
  const template = await apiFetch<WorkoutTemplate>(
    `/api/templates/${id}/duplicate`,
    { method: "POST" },
  );
  mutate("/api/templates");
  return template;
}
