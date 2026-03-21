import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, notFound, unauthorized } from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { calculate1RM, toNumber } from "@/lib/utils";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/stats/exercise/[id] - Get exercise-specific progress
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id: exerciseId } = await params;

  const exercise = await prisma.exercise.findFirst({
    where: {
      id: exerciseId,
      OR: [{ isPublic: true }, { createdById: user.id }],
    },
  });

  if (!exercise) return notFound("Exercise not found");

  // Get all sets for this exercise from non-archived workouts
  const workoutExercises = await prisma.workoutExercise.findMany({
    where: {
      exerciseId,
      workout: {
        userId: user.id,
        isArchived: false,
        endedAt: { not: null },
      },
    },
    include: {
      sets: {
        where: { isWarmup: false },
        orderBy: { order: "asc" },
      },
      workout: {
        select: { startedAt: true },
      },
    },
    orderBy: {
      workout: { startedAt: "asc" },
    },
  });

  // Build history: for each workout, calculate best set and estimated 1RM
  const history = workoutExercises.map((we) => {
    let bestSet = { reps: 0, weight: 0, e1rm: 0 };

    for (const set of we.sets) {
      const weight = toNumber(set.weightKg);
      const e1rm = calculate1RM(weight, set.reps);

      if (e1rm > bestSet.e1rm) {
        bestSet = { reps: set.reps, weight, e1rm };
      }
    }

    return {
      date: we.workout.startedAt,
      bestSet: {
        reps: bestSet.reps,
        weight: bestSet.weight,
      },
      estimated1RM: Math.round(bestSet.e1rm * 10) / 10,
      totalSets: we.sets.length,
      totalVolume: we.sets.reduce((sum, set) => {
        const weight = toNumber(set.weightKg);
        return sum + weight * set.reps;
      }, 0),
    };
  });

  // Calculate current PR (highest e1RM ever)
  const pr =
    history.length > 0
      ? history.reduce(
          (max, h) => (h.estimated1RM > max.estimated1RM ? h : max),
          history[0],
        )
      : null;

  return NextResponse.json({
    exercise,
    history,
    pr,
  });
}
