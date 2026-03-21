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
import { updateEquipmentSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/equipment/[id] - Update private equipment (owner only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  // Check ownership
  const existing = await prisma.equipment.findUnique({
    where: { id },
  });

  if (!existing) return notFound("Equipment not found");

  if (existing.isPublic || existing.createdById !== user.id) {
    return forbidden("Cannot edit this equipment");
  }

  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = updateEquipmentSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const { name, czechName } = parsed.data;

  const equipment = await prisma.equipment.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(czechName !== undefined && { czechName }),
    },
  });

  return NextResponse.json(equipment);
}

// DELETE /api/equipment/[id] - Delete private equipment (owner only)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  // Check ownership
  const existing = await prisma.equipment.findUnique({
    where: { id },
  });

  if (!existing) return notFound("Equipment not found");

  if (existing.isPublic || existing.createdById !== user.id) {
    return forbidden("Cannot delete this equipment");
  }

  await prisma.equipment.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
