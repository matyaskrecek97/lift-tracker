import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  notFound,
  parseJsonBody,
  unauthorized,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { addSetSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string; exerciseId: string }> };

// POST /api/workouts/[id]/exercises/[exerciseId]/sets - Add set
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id: workoutId, exerciseId } = await params;
  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = addSetSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  // Verify workout belongs to user
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId: user.id },
  });

  if (!workout) return notFound("Workout not found");

  const workoutExercise = await prisma.workoutExercise.findFirst({
    where: { id: exerciseId, workoutId },
    include: { sets: { select: { order: true } } },
  });

  if (!workoutExercise) return notFound("Workout exercise not found");

  // Calculate order (append to end if not specified)
  const maxOrder = workoutExercise.sets.reduce(
    (max, s) => Math.max(max, s.order),
    -1,
  );
  const order = parsed.data.order ?? maxOrder + 1;

  const set = await prisma.workoutSet.create({
    data: {
      workoutExerciseId: exerciseId,
      reps: parsed.data.reps,
      weightKg: parsed.data.weightKg,
      isWarmup: parsed.data.isWarmup ?? false,
      order,
    },
  });

  return NextResponse.json(set, { status: 201 });
}
