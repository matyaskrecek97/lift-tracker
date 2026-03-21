import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  parseJsonBody,
  unauthorized,
  verifyPlaceAccess,
} from "@/lib/api-utils";
import prisma, { workoutFullInclude } from "@/lib/prisma";
import { createWorkoutSchema } from "@/lib/validations";

// GET /api/workouts - List user's workouts
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit")) || 20, 1),
    100,
  );
  const offset = Math.max(
    Number(request.nextUrl.searchParams.get("offset")) || 0,
    0,
  );
  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") === "true";

  const workouts = await prisma.workout.findMany({
    where: {
      userId: user.id,
      ...(includeArchived ? {} : { isArchived: false }),
    },
    include: workoutFullInclude,
    orderBy: { startedAt: "desc" },
    take: limit,
    skip: offset,
  });

  return NextResponse.json(workouts);
}

// POST /api/workouts - Start a new workout
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = createWorkoutSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const { templateId, placeId, name, notes } = parsed.data;

  if (placeId && !(await verifyPlaceAccess(placeId, user.id))) {
    return badRequest("Invalid place");
  }

  // If creating from template, copy template items as workout exercises
  let exercisesToCreate: {
    exerciseId: string;
    equipmentId?: string | null;
    order: number;
  }[] = [];
  let workoutName = name;

  if (templateId) {
    const template = await prisma.workoutTemplate.findFirst({
      where: { id: templateId, userId: user.id },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { exercise: { select: { equipmentId: true } } },
        },
      },
    });

    if (template) {
      exercisesToCreate = template.items.map((item) => ({
        exerciseId: item.exerciseId,
        equipmentId: item.equipmentId ?? item.exercise.equipmentId,
        order: item.order,
      }));
      // Use template name as workout name if not explicitly provided
      if (!workoutName) {
        workoutName = template.name;
      }
    }
  }

  const workout = await prisma.workout.create({
    data: {
      userId: user.id,
      name: workoutName,
      placeId,
      notes,
      exercises: {
        create: exercisesToCreate,
      },
    },
    include: workoutFullInclude,
  });

  return NextResponse.json(workout, { status: 201 });
}
