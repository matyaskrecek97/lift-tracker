import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  notFound,
  parseJsonBody,
  unauthorized,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { createTemplateFromWorkoutSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/workouts/[id]/create-template - Create a template from a workout's exercises
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const result = await parseJsonBody(request);
  const body = "error" in result ? {} : result.data;
  const parsed = createTemplateFromWorkoutSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const workout = await prisma.workout.findFirst({
    where: { id, userId: user.id },
    include: {
      exercises: { orderBy: { order: "asc" } },
    },
  });

  if (!workout) return notFound("Workout not found");

  const templateName = parsed.data.name || workout.name || "Untitled Template";

  const template = await prisma.workoutTemplate.create({
    data: {
      userId: user.id,
      name: templateName,
      items: {
        create: workout.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          equipmentId: ex.equipmentId,
          order: ex.order,
        })),
      },
    },
    include: {
      items: {
        include: {
          exercise: {
            include: {
              primaryBodyPart: true,
              secondaryBodyParts: true,
              equipment: true,
            },
          },
          equipment: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  return NextResponse.json(template, { status: 201 });
}
