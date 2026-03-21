import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  notFound,
  parseJsonBody,
  unauthorized,
  verifyEquipmentAccess,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { addWorkoutExerciseSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/workouts/[id]/exercises - Add exercise to workout
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id: workoutId } = await params;
  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = addWorkoutExerciseSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  // Verify workout belongs to user
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId: user.id },
    include: {
      exercises: { select: { order: true } },
    },
  });

  if (!workout) return notFound("Workout not found");

  // Verify exercise exists and user has access
  const exercise = await prisma.exercise.findFirst({
    where: {
      id: parsed.data.exerciseId,
      OR: [{ isPublic: true }, { createdById: user.id }],
    },
  });

  if (!exercise) return notFound("Exercise not found");

  if (
    parsed.data.equipmentId &&
    !(await verifyEquipmentAccess(parsed.data.equipmentId, user.id))
  ) {
    return badRequest("Invalid equipment");
  }

  // Calculate order (append to end if not specified)
  const maxOrder = workout.exercises.reduce(
    (max, e) => Math.max(max, e.order),
    -1,
  );
  const order = parsed.data.order ?? maxOrder + 1;

  const workoutExercise = await prisma.workoutExercise.create({
    data: {
      workoutId,
      exerciseId: parsed.data.exerciseId,
      equipmentId: parsed.data.equipmentId || null,
      order,
    },
    include: {
      exercise: {
        include: {
          primaryBodyPart: true,
          secondaryBodyParts: true,
          equipment: true,
        },
      },
      equipment: true,
      sets: {
        orderBy: { order: "asc" },
      },
    },
  });

  return NextResponse.json(workoutExercise, { status: 201 });
}
