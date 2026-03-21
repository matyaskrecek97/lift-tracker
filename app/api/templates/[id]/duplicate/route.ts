import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, notFound, unauthorized } from "@/lib/api-utils";
import prisma from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/templates/[id]/duplicate - Clone a template with all its items
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const source = await prisma.workoutTemplate.findFirst({
    where: { id, userId: user.id },
    include: { items: { orderBy: { order: "asc" } } },
  });

  if (!source) return notFound("Template not found");

  const template = await prisma.workoutTemplate.create({
    data: {
      userId: user.id,
      name: `Copy of ${source.name}`,
      items: {
        create: source.items.map((item) => ({
          exerciseId: item.exerciseId,
          equipmentId: item.equipmentId,
          order: item.order,
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
