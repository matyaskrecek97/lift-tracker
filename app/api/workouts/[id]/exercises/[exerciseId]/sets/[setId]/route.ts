import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  notFound,
  parseJsonBody,
  unauthorized,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { updateSetSchema } from "@/lib/validations";

type RouteParams = {
  params: Promise<{ id: string; exerciseId: string; setId: string }>;
};

// PATCH /api/workouts/[id]/exercises/[exerciseId]/sets/[setId] - Update set
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id: workoutId, exerciseId, setId } = await params;
  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = updateSetSchema.safeParse(body);

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
  });

  if (!workoutExercise) return notFound("Workout exercise not found");

  const existing = await prisma.workoutSet.findFirst({
    where: { id: setId, workoutExerciseId: exerciseId },
  });

  if (!existing) return notFound("Set not found");

  const set = await prisma.workoutSet.update({
    where: { id: setId },
    data: parsed.data,
  });

  return NextResponse.json(set);
}

// DELETE /api/workouts/[id]/exercises/[exerciseId]/sets/[setId] - Delete set
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id: workoutId, exerciseId, setId } = await params;

  // Verify workout belongs to user
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId: user.id },
  });

  if (!workout) return notFound("Workout not found");

  const workoutExercise = await prisma.workoutExercise.findFirst({
    where: { id: exerciseId, workoutId },
  });

  if (!workoutExercise) return notFound("Workout exercise not found");

  const existing = await prisma.workoutSet.findFirst({
    where: { id: setId, workoutExerciseId: exerciseId },
  });

  if (!existing) return notFound("Set not found");

  await prisma.workoutSet.delete({ where: { id: setId } });

  return new NextResponse(null, { status: 204 });
}
