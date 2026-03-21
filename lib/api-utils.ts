import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "./auth";
import prisma from "./prisma";

export async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  return session.user;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function verifyPlaceAccess(
  placeId: string,
  userId: string,
): Promise<boolean> {
  const place = await prisma.place.findFirst({
    where: { id: placeId, userId },
    select: { id: true },
  });
  return !!place;
}

export async function verifyExerciseAccess(
  exerciseId: string,
  userId: string,
): Promise<boolean> {
  const exercise = await prisma.exercise.findFirst({
    where: {
      id: exerciseId,
      OR: [{ isPublic: true }, { createdById: userId }],
    },
    select: { id: true },
  });
  return !!exercise;
}

export async function verifyEquipmentAccess(
  equipmentId: string,
  userId: string,
): Promise<boolean> {
  const equipment = await prisma.equipment.findFirst({
    where: {
      id: equipmentId,
      OR: [{ isPublic: true }, { createdById: userId }],
    },
    select: { id: true },
  });
  return !!equipment;
}

export async function parseJsonBody<T = unknown>(
  request: Request,
): Promise<{ data: T } | { error: ReturnType<typeof badRequest> }> {
  try {
    const data = await request.json();
    return { data };
  } catch {
    return { error: badRequest("Invalid JSON body") };
  }
}
