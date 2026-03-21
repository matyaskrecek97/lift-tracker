import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  notFound,
  unauthorized,
} from "@/lib/api-utils";
import prisma, { workoutFullInclude } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/workouts/[id]/duplicate - Deep-copy a finished workout
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const source = await prisma.workout.findFirst({
    where: { id, userId: user.id },
    include: {
      exercises: {
        include: { sets: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!source) return notFound("Workout not found");
  if (!source.endedAt)
    return badRequest("Only finished workouts can be duplicated");

  const now = new Date();

  const workout = await prisma.workout.create({
    data: {
      userId: user.id,
      name: source.name ? `Copy of ${source.name}` : null,
      placeId: source.placeId,
      notes: source.notes,
      startedAt: now,
      exercises: {
        create: source.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          equipmentId: ex.equipmentId,
          order: ex.order,
          notes: ex.notes,
          sets: {
            create: ex.sets.map((s) => ({
              order: s.order,
              reps: s.reps,
              weightKg: s.weightKg,
              isWarmup: s.isWarmup,
            })),
          },
        })),
      },
    },
    include: workoutFullInclude,
  });

  return NextResponse.json(workout, { status: 201 });
}
