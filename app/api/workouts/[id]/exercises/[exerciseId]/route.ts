import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  notFound,
  parseJsonBody,
  unauthorized,
  verifyEquipmentAccess,
  verifyExerciseAccess,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { updateWorkoutExerciseSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string; exerciseId: string }> };

// PATCH /api/workouts/[id]/exercises/[exerciseId] - Update workout exercise
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id: workoutId, exerciseId } = await params;
  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = updateWorkoutExerciseSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  // Verify workout belongs to user
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId: user.id },
  });

  if (!workout) return notFound("Workout not found");

  const existing = await prisma.workoutExercise.findFirst({
    where: { id: exerciseId, workoutId },
  });

  if (!existing) return notFound("Workout exercise not found");

  if (
    parsed.data.exerciseId &&
    !(await verifyExerciseAccess(parsed.data.exerciseId, user.id))
  ) {
    return badRequest("Invalid exercise");
  }

  if (
    parsed.data.equipmentId &&
    !(await verifyEquipmentAccess(parsed.data.equipmentId, user.id))
  ) {
    return badRequest("Invalid equipment");
  }

  const workoutExercise = await prisma.workoutExercise.update({
    where: { id: exerciseId },
    data: parsed.data,
    include: {
      exercise: true,
      equipment: true,
      sets: {
        orderBy: { order: "asc" },
      },
    },
  });

  return NextResponse.json(workoutExercise);
}

// DELETE /api/workouts/[id]/exercises/[exerciseId] - Remove exercise from workout
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id: workoutId, exerciseId } = await params;

  // Verify workout belongs to user
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId: user.id },
  });

  if (!workout) return notFound("Workout not found");

  const existing = await prisma.workoutExercise.findFirst({
    where: { id: exerciseId, workoutId },
  });

  if (!existing) return notFound("Workout exercise not found");

  await prisma.workoutExercise.delete({ where: { id: exerciseId } });

  return new NextResponse(null, { status: 204 });
}
