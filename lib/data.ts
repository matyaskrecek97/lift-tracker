import { cache } from "react";
import type { Prisma } from "@/app/generated/prisma/client";
import type {
  DateRange,
  Exercise,
  Place,
  Stats,
  Workout,
  WorkoutTemplate,
} from "./hooks";
import prisma, { workoutFullInclude } from "./prisma";
import { calculate1RM, toNumber } from "./utils";

const templateFullInclude = {
  items: {
    include: {
      exercise: {
        include: {
          primaryBodyPart: true,
          secondaryBodyParts: true,
          equipment: true,
        },
      },
      equipment: true,
    },
    orderBy: { order: "asc" as const },
  },
};

/**
 * Convert Prisma workout to a serializable Workout matching the hooks interface.
 * Handles Decimal → number (weightKg) and Date → ISO string (timestamps).
 */
// biome-ignore lint/suspicious/noExplicitAny: transforming Prisma result with nested dynamic structure
function serializeWorkout(raw: any): Workout {
  return {
    ...raw,
    startedAt:
      raw.startedAt instanceof Date
        ? raw.startedAt.toISOString()
        : raw.startedAt,
    endedAt:
      raw.endedAt instanceof Date
        ? raw.endedAt.toISOString()
        : (raw.endedAt ?? null),
    // biome-ignore lint/suspicious/noExplicitAny: nested transformation
    exercises: raw.exercises.map((ex: any) => ({
      ...ex,
      // biome-ignore lint/suspicious/noExplicitAny: nested transformation
      sets: ex.sets.map((set: any) => ({
        ...set,
        weightKg: toNumber(set.weightKg),
      })),
    })),
  };
}

export const getWorkouts = cache(
  async (userId: string, limit = 20): Promise<Workout[]> => {
    const workouts = await prisma.workout.findMany({
      where: { userId, isArchived: false },
      include: workoutFullInclude,
      orderBy: { startedAt: "desc" },
      take: limit,
    });
    return workouts.map(serializeWorkout);
  },
);

export const getWorkout = cache(
  async (userId: string, id: string): Promise<Workout | null> => {
    const workout = await prisma.workout.findFirst({
      where: { id, userId },
      include: workoutFullInclude,
    });
    if (!workout) return null;
    return serializeWorkout(workout);
  },
);

export const getPlaces = cache(async (userId: string): Promise<Place[]> => {
  const places = await prisma.place.findMany({
    where: { userId, isArchived: false },
    orderBy: { createdAt: "desc" },
  });
  return places as unknown as Place[];
});

export const getTemplates = cache(
  async (userId: string): Promise<WorkoutTemplate[]> => {
    const templates = await prisma.workoutTemplate.findMany({
      where: { userId },
      include: templateFullInclude,
      orderBy: { updatedAt: "desc" },
    });
    return templates as unknown as WorkoutTemplate[];
  },
);

export const getTemplate = cache(
  async (userId: string, id: string): Promise<WorkoutTemplate | null> => {
    const template = await prisma.workoutTemplate.findFirst({
      where: { id, userId },
      include: templateFullInclude,
    });
    if (!template) return null;
    return template as unknown as WorkoutTemplate;
  },
);

export const getStats = cache(
  async (userId: string, dateRange?: DateRange): Promise<Stats> => {
    const now = new Date();

    const startDate = dateRange?.startDate
      ? new Date(dateRange.startDate)
      : new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    startDate.setHours(0, 0, 0, 0);

    const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : now;
    endDate.setHours(23, 59, 59, 999);

    const workouts = await prisma.workout.findMany({
      where: {
        userId,
        isArchived: false,
        endedAt: { not: null },
        startedAt: { gte: startDate, lte: endDate },
      },
      include: {
        exercises: {
          include: { sets: true, exercise: true },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    const allWorkouts = await prisma.workout.findMany({
      where: { userId, isArchived: false, endedAt: { not: null } },
      select: { startedAt: true },
      orderBy: { startedAt: "desc" },
    });

    const totalWorkouts = workouts.length;

    const totalVolume = workouts.reduce(
      (total, workout) =>
        total +
        workout.exercises.reduce(
          (exTotal, ex) =>
            exTotal +
            ex.sets
              .filter((s) => !s.isWarmup)
              .reduce(
                (setTotal, set) => setTotal + toNumber(set.weightKg) * set.reps,
                0,
              ),
          0,
        ),
      0,
    );

    const totalSets = workouts.reduce(
      (total, workout) =>
        total +
        workout.exercises.reduce(
          (exTotal, ex) => exTotal + ex.sets.filter((s) => !s.isWarmup).length,
          0,
        ),
      0,
    );

    // Streak: consecutive weeks with at least one workout
    function toLocalDateKey(d: Date): string {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weekSet = new Set<string>();
    for (const workout of allWorkouts) {
      const date = new Date(workout.startedAt);
      const ws = new Date(date);
      ws.setDate(date.getDate() - date.getDay());
      ws.setHours(0, 0, 0, 0);
      weekSet.add(toLocalDateKey(ws));
    }

    let streak = 0;
    const checkDate = new Date(startOfWeek);
    if (!weekSet.has(toLocalDateKey(checkDate))) {
      checkDate.setDate(checkDate.getDate() - 7);
    }
    while (weekSet.has(toLocalDateKey(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 7);
    }

    // PRs: exercises with a new max e1RM compared to before the range
    const olderWorkouts = await prisma.workout.findMany({
      where: {
        userId,
        isArchived: false,
        endedAt: { not: null },
        startedAt: { lt: startDate },
      },
      include: { exercises: { include: { sets: true } } },
    });

    const exerciseMaxBefore = new Map<string, number>();
    for (const workout of olderWorkouts) {
      for (const ex of workout.exercises) {
        for (const set of ex.sets.filter((s) => !s.isWarmup)) {
          const weight = toNumber(set.weightKg);
          const e1rm = calculate1RM(weight, set.reps);
          const current = exerciseMaxBefore.get(ex.exerciseId) ?? 0;
          if (e1rm > current) exerciseMaxBefore.set(ex.exerciseId, e1rm);
        }
      }
    }

    let prsInRange = 0;
    const prExercises = new Set<string>();
    for (const workout of workouts) {
      for (const ex of workout.exercises) {
        for (const set of ex.sets.filter((s) => !s.isWarmup)) {
          const weight = toNumber(set.weightKg);
          const e1rm = calculate1RM(weight, set.reps);
          const previousMax = exerciseMaxBefore.get(ex.exerciseId) ?? 0;
          if (e1rm > previousMax && !prExercises.has(ex.exerciseId)) {
            prExercises.add(ex.exerciseId);
            prsInRange++;
          }
        }
      }
    }

    // Volume history by date
    const volumeByDate = new Map<string, number>();
    for (const workout of workouts) {
      const dateKey = new Date(workout.startedAt).toISOString().split("T")[0];
      const workoutVolume = workout.exercises.reduce(
        (exTotal, ex) =>
          exTotal +
          ex.sets
            .filter((s) => !s.isWarmup)
            .reduce(
              (setTotal, set) => setTotal + toNumber(set.weightKg) * set.reps,
              0,
            ),
        0,
      );
      volumeByDate.set(
        dateKey,
        (volumeByDate.get(dateKey) ?? 0) + workoutVolume,
      );
    }

    const volumeHistory = Array.from(volumeByDate.entries())
      .map(([date, volume]) => ({ date, volume: Math.round(volume) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Average e1RM history
    const e1rmByDate = new Map<string, { total: number; count: number }>();
    for (const workout of workouts) {
      const dateKey = new Date(workout.startedAt).toISOString().split("T")[0];
      for (const ex of workout.exercises) {
        let bestE1rm = 0;
        for (const set of ex.sets.filter((s) => !s.isWarmup)) {
          const weight = toNumber(set.weightKg);
          const e1rm = calculate1RM(weight, set.reps);
          if (e1rm > bestE1rm) bestE1rm = e1rm;
        }
        if (bestE1rm > 0) {
          const existing = e1rmByDate.get(dateKey) ?? { total: 0, count: 0 };
          e1rmByDate.set(dateKey, {
            total: existing.total + bestE1rm,
            count: existing.count + 1,
          });
        }
      }
    }

    const avgE1rmHistory = Array.from(e1rmByDate.entries())
      .map(([date, { total, count }]) => ({
        date,
        avgE1rm: Math.round((total / count) * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Unique exercises used
    const exercisesUsedMap = new Map<
      string,
      { id: string; name: string; czechName: string | null }
    >();
    for (const workout of workouts) {
      for (const ex of workout.exercises) {
        if (!exercisesUsedMap.has(ex.exerciseId)) {
          exercisesUsedMap.set(ex.exerciseId, {
            id: ex.exercise.id,
            name: ex.exercise.name,
            czechName: ex.exercise.czechName,
          });
        }
      }
    }

    return {
      totalWorkouts,
      totalVolume: Math.round(totalVolume),
      totalSets,
      streak,
      prsInRange,
      volumeHistory,
      avgE1rmHistory,
      exercisesUsed: Array.from(exercisesUsedMap.values()),
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  },
);

export const getExercises = cache(
  async (
    userId: string,
    query?: string,
    includePrivate = true,
  ): Promise<Exercise[]> => {
    const whereClause: Prisma.ExerciseWhereInput = {};

    if (includePrivate) {
      whereClause.OR = [{ isPublic: true }, { createdById: userId }];
    } else {
      whereClause.isPublic = true;
    }

    if (query) {
      whereClause.AND = [
        whereClause.OR ? { OR: whereClause.OR } : { isPublic: true },
        {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { czechName: { contains: query, mode: "insensitive" } },
          ],
        },
      ];
      delete whereClause.OR;
    }

    const exercises = await prisma.exercise.findMany({
      where: whereClause,
      include: {
        primaryBodyPart: true,
        secondaryBodyParts: true,
        equipment: true,
      },
      orderBy: [{ isPublic: "desc" }, { name: "asc" }],
      take: 50,
    });

    return exercises as unknown as Exercise[];
  },
);
