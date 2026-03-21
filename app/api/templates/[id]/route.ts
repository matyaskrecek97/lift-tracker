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
import { updateTemplateSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/templates/[id] - Get single template
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const template = await prisma.workoutTemplate.findFirst({
    where: { id, userId: user.id },
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

  if (!template) return notFound("Template not found");

  return NextResponse.json(template);
}

// PATCH /api/templates/[id] - Update template
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = updateTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const existing = await prisma.workoutTemplate.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) return notFound("Template not found");

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

  // Update template with optional item replacement
  const template = await prisma.$transaction(async (tx) => {
    // If items provided, replace all items
    if (items) {
      await tx.workoutTemplateItem.deleteMany({
        where: { templateId: id },
      });

      await tx.workoutTemplateItem.createMany({
        data: items.map((item) => ({
          templateId: id,
          exerciseId: item.exerciseId,
          equipmentId: item.equipmentId,
          order: item.order,
        })),
      });
    }

    return tx.workoutTemplate.update({
      where: { id },
      data: { ...(name && { name }) },
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
  });

  return NextResponse.json(template);
}

// DELETE /api/templates/[id] - Delete template
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const existing = await prisma.workoutTemplate.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) return notFound("Template not found");

  await prisma.workoutTemplate.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
