import { NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  unauthorized,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { calculate1RM, toNumber } from "@/lib/utils";

// GET /api/stats - Get user's workout statistics
export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  const now = new Date();

  // Default to past month if no dates provided
  const startDate = startDateParam
    ? new Date(startDateParam)
    : new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const endDate = endDateParam ? new Date(endDateParam) : now;

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return badRequest("Invalid date format");
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  // Get workouts within date range for calculating stats
  const workouts = await prisma.workout.findMany({
    where: {
      userId: user.id,
      isArchived: false,
      endedAt: { not: null },
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      exercises: {
        include: {
          sets: true,
          exercise: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  // Get all workouts for streak calculation (need full history)
  const allWorkouts = await prisma.workout.findMany({
    where: {
      userId: user.id,
      isArchived: false,
      endedAt: { not: null },
    },
    select: { startedAt: true },
    orderBy: { startedAt: "desc" },
  });

  // Total workouts in date range
  const totalWorkouts = workouts.length;

  // Calculate total volume in date range
  const totalVolume = workouts.reduce((total, workout) => {
    return (
      total +
      workout.exercises.reduce((exTotal, ex) => {
        return (
          exTotal +
          ex.sets
            .filter((s) => !s.isWarmup)
            .reduce((setTotal, set) => {
              const weight = toNumber(set.weightKg);
              return setTotal + weight * set.reps;
            }, 0)
        );
      }, 0)
    );
  }, 0);

  // Calculate total sets in date range
  const totalSets = workouts.reduce((total, workout) => {
    return (
      total +
      workout.exercises.reduce((exTotal, ex) => {
        return exTotal + ex.sets.filter((s) => !s.isWarmup).length;
      }, 0)
    );
  }, 0);

  // Calculate streak (consecutive weeks with at least one workout)
  function toLocalDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weekSet = new Set<string>();
  for (const workout of allWorkouts) {
    const date = new Date(workout.startedAt);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    weekStart.setHours(0, 0, 0, 0);
    weekSet.add(toLocalDateKey(weekStart));
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

  // Count PRs in date range (exercises with a new max e1RM compared to before the range)
  // Get workouts before the date range for comparison
  const olderWorkouts = await prisma.workout.findMany({
    where: {
      userId: user.id,
      isArchived: false,
      endedAt: { not: null },
      startedAt: { lt: startDate },
    },
    include: {
      exercises: {
        include: { sets: true },
      },
    },
  });

  const exerciseMaxBefore = new Map<string, number>();
  for (const workout of olderWorkouts) {
    for (const ex of workout.exercises) {
      for (const set of ex.sets.filter((s) => !s.isWarmup)) {
        const weight = toNumber(set.weightKg);
        const e1rm = calculate1RM(weight, set.reps);
        const current = exerciseMaxBefore.get(ex.exerciseId) ?? 0;
        if (e1rm > current) {
          exerciseMaxBefore.set(ex.exerciseId, e1rm);
        }
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

  // Build volume history by date (for the chart)
  const volumeByDate = new Map<string, number>();
  for (const workout of workouts) {
    const dateKey = new Date(workout.startedAt).toISOString().split("T")[0];
    const workoutVolume = workout.exercises.reduce((exTotal, ex) => {
      return (
        exTotal +
        ex.sets
          .filter((s) => !s.isWarmup)
          .reduce((setTotal, set) => {
            const weight = toNumber(set.weightKg);
            return setTotal + weight * set.reps;
          }, 0)
      );
    }, 0);
    volumeByDate.set(dateKey, (volumeByDate.get(dateKey) ?? 0) + workoutVolume);
  }

  const volumeHistory = Array.from(volumeByDate.entries())
    .map(([date, volume]) => ({ date, volume: Math.round(volume) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Build average e1RM history across all exercises by date
  // For each workout day, calculate the average of best e1RM for each exercise performed
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

  // Get unique exercises used in workouts within the date range
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
  const exercisesUsed = Array.from(exercisesUsedMap.values());

  return NextResponse.json({
    totalWorkouts,
    totalVolume: Math.round(totalVolume),
    totalSets,
    streak,
    prsInRange,
    volumeHistory,
    avgE1rmHistory,
    exercisesUsed,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  });
}
