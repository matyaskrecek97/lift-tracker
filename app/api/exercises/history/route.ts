import { NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  parseJsonBody,
  unauthorized,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { exerciseHistorySchema } from "@/lib/validations";

type WorkoutExerciseRow = {
  exerciseId: string;
  equipmentId: string | null;
  exercise: { equipmentId: string | null };
  workout: { startedAt: Date };
  sets: { reps: number; weightKg: unknown }[];
};

function pickBestFromLatest(
  entries: WorkoutExerciseRow[],
): { reps: number; weight: number } | null {
  if (entries.length === 0) return null;

  const latestDate = entries[0].workout.startedAt.getTime();
  const latestSets = entries
    .filter((e) => e.workout.startedAt.getTime() === latestDate)
    .flatMap((e) => e.sets);

  if (latestSets.length === 0) return null;

  let best = latestSets[0];
  for (const s of latestSets) {
    if (toNumber(s.weightKg) > toNumber(best.weightKg)) {
      best = s;
    }
  }

  return { reps: best.reps, weight: toNumber(best.weightKg) };
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = exerciseHistorySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const { exerciseIds, excludeWorkoutId, equipmentByExercise } = parsed.data;

  const workoutExercises = await prisma.workoutExercise.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      workout: {
        userId: user.id,
        endedAt: { not: null },
        isArchived: false,
        ...(excludeWorkoutId ? { id: { not: excludeWorkoutId } } : {}),
      },
    },
    select: {
      exerciseId: true,
      equipmentId: true,
      exercise: { select: { equipmentId: true } },
      workout: { select: { startedAt: true } },
      sets: {
        where: { isWarmup: false },
        select: { reps: true, weightKg: true },
      },
    },
    orderBy: { workout: { startedAt: "desc" } },
  });

  const history: Record<string, { reps: number; weight: number } | null> = {};

  const byExercise = new Map<string, WorkoutExerciseRow[]>();
  for (const we of workoutExercises) {
    if (!byExercise.has(we.exerciseId)) {
      byExercise.set(we.exerciseId, []);
    }
    byExercise.get(we.exerciseId)?.push(we);
  }

  for (const exerciseId of exerciseIds) {
    const entries = byExercise.get(exerciseId);
    if (!entries || entries.length === 0) {
      history[exerciseId] = null;
      continue;
    }

    const requestedEquipmentId = equipmentByExercise?.[exerciseId];

    if (requestedEquipmentId) {
      const effectiveMatch = (row: WorkoutExerciseRow) =>
        (row.equipmentId ?? row.exercise.equipmentId) === requestedEquipmentId;

      const matched = entries.filter(effectiveMatch);
      const result = pickBestFromLatest(matched);
      if (result) {
        history[exerciseId] = result;
        continue;
      }
    }

    history[exerciseId] = pickBestFromLatest(entries);
  }

  return NextResponse.json(history);
}
