import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  notFound,
  parseJsonBody,
  unauthorized,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { updatePlaceSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/places/[id] - Update place
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = updatePlaceSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const existing = await prisma.place.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) return notFound("Place not found");

  const place = await prisma.place.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(place);
}

// DELETE /api/places/[id] - Archive place
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const existing = await prisma.place.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) return notFound("Place not found");

  await prisma.place.update({
    where: { id },
    data: { isArchived: true },
  });

  return new NextResponse(null, { status: 204 });
}
