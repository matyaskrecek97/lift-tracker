import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  forbidden,
  getAuthenticatedUser,
  notFound,
  parseJsonBody,
  unauthorized,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { updateExerciseSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/exercises/[id] - Update a private exercise (owner only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  // Check ownership
  const existing = await prisma.exercise.findUnique({
    where: { id },
  });

  if (!existing) return notFound("Exercise not found");

  if (existing.isPublic || existing.createdById !== user.id) {
    return forbidden("Cannot edit this exercise");
  }

  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = updateExerciseSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const {
    name,
    czechName,
    primaryBodyPartSlug,
    secondaryBodyPartSlugs,
    equipmentSlug,
  } = parsed.data;

  // Resolve IDs
  const primaryBodyPart = primaryBodyPartSlug
    ? await prisma.bodyPart.findUnique({ where: { slug: primaryBodyPartSlug } })
    : undefined;

  const secondaryBodyParts = secondaryBodyPartSlugs
    ? await prisma.bodyPart.findMany({
        where: { slug: { in: secondaryBodyPartSlugs } },
      })
    : undefined;

  const equipment = equipmentSlug
    ? await prisma.equipment.findUnique({ where: { slug: equipmentSlug } })
    : undefined;

  const exercise = await prisma.exercise.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(czechName !== undefined && { czechName }),
      ...(primaryBodyPart !== undefined && {
        primaryBodyPartId: primaryBodyPart?.id || null,
      }),
      ...(equipment !== undefined && { equipmentId: equipment?.id || null }),
      ...(secondaryBodyParts && {
        secondaryBodyParts: {
          set: secondaryBodyParts.map((bp) => ({ id: bp.id })),
        },
      }),
    },
    include: {
      primaryBodyPart: true,
      secondaryBodyParts: true,
      equipment: true,
    },
  });

  return NextResponse.json(exercise);
}

// DELETE /api/exercises/[id] - Delete/archive a private exercise (owner only)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  // Check ownership
  const existing = await prisma.exercise.findUnique({
    where: { id },
  });

  if (!existing) return notFound("Exercise not found");

  if (existing.isPublic || existing.createdById !== user.id) {
    return forbidden("Cannot delete this exercise");
  }

  await prisma.exercise.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
