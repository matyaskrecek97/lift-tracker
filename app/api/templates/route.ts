import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  parseJsonBody,
  unauthorized,
  verifyEquipmentAccess,
  verifyExerciseAccess,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { createTemplateSchema } from "@/lib/validations";

// GET /api/templates - List user's workout templates
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const templates = await prisma.workoutTemplate.findMany({
    where: { userId: user.id },
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
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(templates);
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = createTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const { name, items } = parsed.data;

  if (items) {
    for (const item of items) {
      if (!(await verifyExerciseAccess(item.exerciseId, user.id))) {
        return badRequest("Invalid exercise");
      }
      if (
        item.equipmentId &&
        !(await verifyEquipmentAccess(item.equipmentId, user.id))
      ) {
        return badRequest("Invalid equipment");
      }
    }
  }

  const template = await prisma.workoutTemplate.create({
    data: {
      userId: user.id,
      name,
      items: items
        ? {
            create: items.map((item) => ({
              exerciseId: item.exerciseId,
              equipmentId: item.equipmentId,
              order: item.order,
            })),
          }
        : undefined,
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
