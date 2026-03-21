import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  notFound,
  parseJsonBody,
  unauthorized,
  verifyPlaceAccess,
} from "@/lib/api-utils";
import prisma, { workoutFullInclude } from "@/lib/prisma";
import { updateWorkoutSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/workouts/[id] - Get workout with full details
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const workout = await prisma.workout.findFirst({
    where: { id, userId: user.id },
    include: workoutFullInclude,
  });

  if (!workout) return notFound("Workout not found");

  return NextResponse.json(workout);
}

// PATCH /api/workouts/[id] - Update workout (notes, place, end)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = updateWorkoutSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const existing = await prisma.workout.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) return notFound("Workout not found");

  if (
    parsed.data.placeId &&
    !(await verifyPlaceAccess(parsed.data.placeId, user.id))
  ) {
    return badRequest("Invalid place");
  }

  const workout = await prisma.workout.update({
    where: { id },
    data: parsed.data,
    include: workoutFullInclude,
  });

  return NextResponse.json(workout);
}

// DELETE /api/workouts/[id] - Archive workout
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const existing = await prisma.workout.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) return notFound("Workout not found");

  await prisma.workout.update({
    where: { id },
    data: { isArchived: true },
  });

  return new NextResponse(null, { status: 204 });
}
